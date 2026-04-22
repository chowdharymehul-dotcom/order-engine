import { getCloudConvertApiKey } from "@/lib/ocr";

type CloudConvertTask = {
  id: string;
  name: string;
  operation: string;
  status: string;
  message?: string;
  code?: string;
  result?: any;
};

type CloudConvertJob = {
  id: string;
  status: string;
  tasks: CloudConvertTask[];
};

type ExtractTextResult = {
  text: string;
  jobId: string;
  strategy: "direct" | "ocr";
  directTextLength: number;
  ocrTextLength: number;
};

const CLOUDCONVERT_API_BASE = "https://api.cloudconvert.com/v2";
const MIN_USEFUL_TEXT_LENGTH = 20;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 120;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTaskByName(tasks: CloudConvertTask[], name: string) {
  const task = tasks.find((t) => t.name === name);

  if (!task) {
    const available = tasks.map((t) => t.name).join(", ");
    throw new Error(`Missing task: ${name}. Available tasks: ${available}`);
  }

  return task;
}

function cleanExtractedText(text: string) {
  return text.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function summarizeTask(task: CloudConvertTask) {
  return {
    id: task.id,
    name: task.name,
    operation: task.operation,
    status: task.status,
    code: task.code ?? null,
    message: task.message ?? null,
    result: task.result ?? null,
  };
}

function buildTaskFailureError(job: CloudConvertJob) {
  const failedTask = job.tasks.find(
    (task) => task.status === "error" || task.status === "failed"
  );

  if (!failedTask) {
    return null;
  }

  return new Error(
    JSON.stringify({
      step: "cloudconvert_task_error",
      jobId: job.id,
      task: summarizeTask(failedTask),
      allTasks: job.tasks.map(summarizeTask),
    })
  );
}

function toExactArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function createJob(tasks: Record<string, any>): Promise<CloudConvertJob> {
  const apiKey = getCloudConvertApiKey();

  const res = await fetch(`${CLOUDCONVERT_API_BASE}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tasks }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      JSON.stringify({
        step: "create_job",
        status: res.status,
        error: data,
      })
    );
  }

  if (!data?.data) {
    throw new Error(
      JSON.stringify({
        step: "create_job",
        error: "CloudConvert did not return job data",
        response: data,
      })
    );
  }

  return data.data as CloudConvertJob;
}

async function uploadFile(
  importTask: CloudConvertTask,
  buffer: Buffer,
  filename: string
) {
  const form = importTask?.result?.form;

  if (!form?.url || !form?.parameters) {
    throw new Error(
      JSON.stringify({
        step: "upload_file",
        error: "Missing CloudConvert upload form data",
        importTask: summarizeTask(importTask),
      })
    );
  }

  const formData = new FormData();

  for (const [key, value] of Object.entries(form.parameters)) {
    formData.append(key, String(value));
  }

  const arrayBuffer = toExactArrayBuffer(buffer);
  const fileBlob = new Blob([arrayBuffer], { type: "application/pdf" });
  formData.append("file", fileBlob, filename);

  const res = await fetch(form.url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      JSON.stringify({
        step: "upload_file",
        status: res.status,
        error: "Upload failed",
        response: bodyText,
      })
    );
  }
}

async function waitForJob(jobId: string): Promise<CloudConvertJob> {
  const apiKey = getCloudConvertApiKey();

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const res = await fetch(`${CLOUDCONVERT_API_BASE}/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        JSON.stringify({
          step: "wait_for_job",
          status: res.status,
          error: data,
        })
      );
    }

    const job = data?.data as CloudConvertJob | undefined;

    if (!job) {
      throw new Error(
        JSON.stringify({
          step: "wait_for_job",
          error: "Missing job data while polling",
          response: data,
        })
      );
    }

    const taskFailure = buildTaskFailureError(job);
    if (taskFailure) {
      throw taskFailure;
    }

    if (job.status === "finished") {
      return job;
    }

    if (job.status === "error" || job.status === "failed") {
      throw new Error(
        JSON.stringify({
          step: "wait_for_job",
          error: "CloudConvert job failed",
          jobId: job.id,
          status: job.status,
          tasks: job.tasks.map(summarizeTask),
        })
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    JSON.stringify({
      step: "wait_for_job",
      error: "CloudConvert polling timed out",
      jobId,
      maxAttempts: MAX_POLL_ATTEMPTS,
      pollIntervalMs: POLL_INTERVAL_MS,
    })
  );
}

async function downloadTextFromExportTask(exportTask: CloudConvertTask) {
  const file = exportTask?.result?.files?.[0];

  if (!file?.url) {
    throw new Error(
      JSON.stringify({
        step: "download_text",
        error: "No exported file URL found",
        exportTask: summarizeTask(exportTask),
      })
    );
  }

  const res = await fetch(file.url, {
    cache: "no-store",
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      JSON.stringify({
        step: "download_text",
        status: res.status,
        error: "Failed to download exported text file",
        response: bodyText,
      })
    );
  }

  return cleanExtractedText(await res.text());
}

async function runDirectPdfToText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; jobId: string }> {
  const job = await createJob({
    "import-file": {
      operation: "import/upload",
    },
    "convert-direct": {
      operation: "convert",
      input: "import-file",
      input_format: "pdf",
      output_format: "txt",
      filename: filename.replace(/\.pdf$/i, ".txt"),
    },
    "export-direct": {
      operation: "export/url",
      input: "convert-direct",
    },
  });

  const importTask = getTaskByName(job.tasks, "import-file");
  await uploadFile(importTask, buffer, filename);

  const finishedJob = await waitForJob(job.id);
  const exportTask = getTaskByName(finishedJob.tasks, "export-direct");
  const text = await downloadTextFromExportTask(exportTask);

  return {
    text,
    jobId: finishedJob.id,
  };
}

async function runOcrPdfToText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; jobId: string }> {
  const ocrPdfFilename = filename.replace(/\.pdf$/i, "-ocr.pdf");
  const txtFilename = filename.replace(/\.pdf$/i, ".txt");

  const job = await createJob({
    "import-file": {
      operation: "import/upload",
    },
    "ocr-file": {
      operation: "pdf/ocr",
      input: "import-file",
      filename: ocrPdfFilename,
    },
    "convert-ocr-text": {
      operation: "convert",
      input: "ocr-file",
      input_format: "pdf",
      output_format: "txt",
      filename: txtFilename,
    },
    "export-ocr-text": {
      operation: "export/url",
      input: "convert-ocr-text",
    },
  });

  const importTask = getTaskByName(job.tasks, "import-file");
  await uploadFile(importTask, buffer, filename);

  const finishedJob = await waitForJob(job.id);
  const exportTask = getTaskByName(finishedJob.tasks, "export-ocr-text");
  const text = await downloadTextFromExportTask(exportTask);

  return {
    text,
    jobId: finishedJob.id,
  };
}

export async function extractTextFromPdfWithCloudConvert(
  buffer: Buffer,
  filename: string
): Promise<ExtractTextResult> {
  const direct = await runDirectPdfToText(buffer, filename);
  const directText = cleanExtractedText(direct.text);

  if (directText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return {
      text: directText,
      jobId: direct.jobId,
      strategy: "direct",
      directTextLength: directText.length,
      ocrTextLength: 0,
    };
  }

  const ocr = await runOcrPdfToText(buffer, filename);
  const ocrText = cleanExtractedText(ocr.text);

  if (ocrText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return {
      text: ocrText,
      jobId: ocr.jobId,
      strategy: "ocr",
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
    };
  }

  throw new Error(
    JSON.stringify({
      step: "extract_text_from_pdf_with_cloudconvert",
      error:
        "Both direct conversion and OCR fallback returned empty/too-short text",
      directJobId: direct.jobId,
      ocrJobId: ocr.jobId,
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
      directPreview: directText.slice(0, 300),
      ocrPreview: ocrText.slice(0, 300),
    })
  );
}