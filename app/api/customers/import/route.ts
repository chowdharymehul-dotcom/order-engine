import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import CloudConvert from "cloudconvert";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ImportedCustomer = {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  gst_number: string;
  pan_number: string;
  iec_number: string;
  notes: string;
};

function clean(value: any) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

function fileExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function isDirectTextFile(extension: string, mimeType: string) {
  return (
    extension === "csv" ||
    extension === "txt" ||
    mimeType.includes("text/csv") ||
    mimeType.includes("text/plain")
  );
}

function emptyCustomer(): ImportedCustomer {
  return {
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    website: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    gst_number: "",
    pan_number: "",
    iec_number: "",
    notes: "",
  };
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function extractWebsite(text: string) {
  const match = text.match(
    /(https?:\/\/[^\s,;]+|www\.[^\s,;]+|[a-z0-9.-]+\.(com|net|org|co|in|com\.br|co\.uk|com\.au))/i
  );

  if (!match) return "";

  const value = match[0].toLowerCase();

  if (value.includes("@")) return "";

  return value;
}

function extractPhoneFromLine(line: string) {
  const cleaned = line.replace(/^tel\s*[:.-]?\s*/i, "").trim();
  const match = cleaned.match(/(\+?\d[\d\s().-]{5,}\d)/);

  return match ? clean(match[1]) : "";
}

function looksLikePhoneLine(line: string) {
  return /^tel\s*[:.-]?/i.test(line) || /(\+?\d[\d\s().-]{6,}\d)/.test(line);
}

function extractContactFromLine(line: string) {
  return clean(line.replace(/^attn\s*[:.-]?\s*/i, ""));
}

function looksLikeContactLine(line: string) {
  return /^attn\s*[:.-]?/i.test(line);
}

function extractPostalCode(text: string) {
  const patterns = [
    /\b\d{5}(?:-\d{4})?\b/,
    /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i,
    /\b\d{6}\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].toUpperCase();
  }

  return "";
}

function extractCountry(lines: string[]) {
  const knownCountries = [
    "USA",
    "UNITED STATES",
    "CANADA",
    "BRAZIL",
    "INDIA",
    "TAIWAN",
    "CHINA",
    "HONG KONG",
    "JAPAN",
    "KOREA",
    "SOUTH KOREA",
    "UK",
    "UNITED KINGDOM",
    "FRANCE",
    "ITALY",
    "SPAIN",
    "GERMANY",
    "PORTUGAL",
    "AUSTRALIA",
    "NEW ZEALAND",
    "MEXICO",
    "UAE",
    "UNITED ARAB EMIRATES",
  ];

  const joined = lines.join(" ").toUpperCase();

  for (const country of knownCountries) {
    if (joined.includes(country)) {
      if (country === "UNITED STATES") return "USA";
      if (country === "UNITED KINGDOM") return "UK";
      if (country === "SOUTH KOREA") return "KOREA";
      if (country === "UNITED ARAB EMIRATES") return "UAE";
      return country;
    }
  }

  const lastLine = clean(lines[lines.length - 1] || "").toUpperCase();

  if (
    lastLine &&
    lastLine.length <= 40 &&
    !looksLikePhoneLine(lastLine) &&
    !looksLikeContactLine(lastLine) &&
    !extractEmail(lastLine)
  ) {
    return lastLine;
  }

  return "";
}

function extractCity(lines: string[], country: string) {
  for (const line of lines) {
    const upper = line.toUpperCase();

    if (country && upper === country) continue;

    if (
      upper.includes(", USA") ||
      upper.includes(", CANADA") ||
      upper.includes(", INDIA") ||
      upper.includes(", BRAZIL") ||
      upper.includes(", TAIWAN")
    ) {
      return clean(line.split(",")[0]);
    }

    if (
      /(LOS ANGELES|NEW YORK|CALIFORNIA|SAO PAULO|TAIPEI|LONDON|PARIS|MILAN|TORONTO|VANCOUVER|MIAMI|DALLAS|CHICAGO|KOLKATA|MUMBAI|DELHI)/i.test(
        line
      )
    ) {
      return clean(line.split(",")[0]);
    }
  }

  return "";
}

function stripNumberPrefix(line: string) {
  return clean(line.replace(/^\s*\d+\)\s*/, ""));
}

function parseNumberedRecord(record: string): ImportedCustomer {
  const customer = emptyCustomer();

  const lines = record
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  if (lines.length === 0) return customer;

  customer.company_name = stripNumberPrefix(lines[0]);

  const detailLines = lines.slice(1);
  const addressLines: string[] = [];

  for (const line of detailLines) {
    const email = extractEmail(line);

    if (email && !customer.email) {
      customer.email = email;
      continue;
    }

    if (looksLikeContactLine(line)) {
      customer.contact_person = extractContactFromLine(line);
      continue;
    }

    if (looksLikePhoneLine(line)) {
      const phone = extractPhoneFromLine(line);

      if (phone && !customer.phone) {
        customer.phone = phone;
        continue;
      }
    }

    const website = extractWebsite(line);

    if (website && !customer.website && !email) {
      customer.website = website;
      continue;
    }

    addressLines.push(line);
  }

  customer.country = extractCountry(addressLines);
  customer.city = extractCity(addressLines, customer.country);
  customer.postal_code = extractPostalCode(addressLines.join(" "));

  customer.address_line_1 = clean(addressLines[0] || "");
  customer.address_line_2 = clean(addressLines.slice(1, 3).join(", "));

  if (!customer.contact_person) {
    const possibleContact = detailLines.find((line) =>
      /purchase|buyer|owner|director|manager|contact/i.test(line)
    );

    if (possibleContact) {
      customer.notes = `Possible contact info: ${possibleContact}`;
    }
  }

  return customer;
}

function splitIntoNumberedRecords(rawText: string) {
  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const records = normalized
    .split(/\n(?=\s*\d+\)\s+)/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => /^\s*\d+\)\s+/.test(part));

  return records;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

function normalizeHeader(header: string) {
  const value = clean(header).toLowerCase();

  if (["company", "company name", "customer", "customer name", "buyer"].includes(value)) {
    return "company_name";
  }

  if (["contact", "contact person", "person", "attn", "attention"].includes(value)) {
    return "contact_person";
  }

  if (["email", "e-mail", "mail"].includes(value)) return "email";
  if (["phone", "telephone", "tel", "mobile"].includes(value)) return "phone";
  if (["website", "web"].includes(value)) return "website";
  if (["address", "address 1", "address line 1"].includes(value)) return "address_line_1";
  if (["address 2", "address line 2"].includes(value)) return "address_line_2";
  if (["city", "town"].includes(value)) return "city";
  if (["state", "province"].includes(value)) return "state";
  if (["country"].includes(value)) return "country";
  if (["postal code", "postcode", "zip", "zip code", "pin"].includes(value)) return "postal_code";
  if (["gst", "gst number", "gst no"].includes(value)) return "gst_number";
  if (["pan", "pan number", "pan no"].includes(value)) return "pan_number";
  if (["iec", "iec number", "iec no"].includes(value)) return "iec_number";
  if (["notes", "remarks", "remark"].includes(value)) return "notes";

  return "";
}

function parseCsvCustomers(rawText: string) {
  const lines = rawText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  if (!headers.includes("company_name") && !headers.includes("email")) {
    return [];
  }

  const customers: ImportedCustomer[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const customer = emptyCustomer();

    cells.forEach((cell, index) => {
      const key = headers[index] as keyof ImportedCustomer;

      if (!key) return;

      customer[key] = clean(cell);
    });

    if (!customer.company_name && customer.email) {
      customer.company_name = customer.email.split("@")[0];
    }

    if (customer.company_name) {
      customers.push(customer);
    }
  }

  return customers;
}

function parseCustomersWithoutAI(rawText: string) {
  const csvCustomers = parseCsvCustomers(rawText);

  if (csvCustomers.length > 0) {
    return {
      customers: dedupeCustomers(csvCustomers),
      detectedCount: csvCustomers.length,
      parserType: "csv_table",
    };
  }

  const numberedRecords = splitIntoNumberedRecords(rawText);

  if (numberedRecords.length > 0) {
    const customers = numberedRecords
      .map(parseNumberedRecord)
      .filter((customer) => clean(customer.company_name));

    return {
      customers: dedupeCustomers(customers),
      detectedCount: numberedRecords.length,
      parserType: "numbered_directory",
    };
  }

  const fallbackCustomers = parseLooseTextCustomers(rawText);

  return {
    customers: dedupeCustomers(fallbackCustomers),
    detectedCount: fallbackCustomers.length,
    parserType: "loose_text",
  };
}

function parseLooseTextCustomers(rawText: string) {
  const blocks = rawText
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const customers: ImportedCustomer[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => clean(line))
      .filter(Boolean);

    if (lines.length === 0) continue;

    const hasEmail = Boolean(extractEmail(block));
    const hasPhone = lines.some(looksLikePhoneLine);

    if (!hasEmail && !hasPhone && lines.length < 2) continue;

    const customer = parseNumberedRecord(`1) ${lines.join("\n")}`);

    if (customer.company_name) {
      customers.push(customer);
    }
  }

  return customers;
}

function dedupeCustomers(customers: ImportedCustomer[]) {
  const deduped = new Map<string, ImportedCustomer>();

  for (const customer of customers) {
    const companyName = clean(customer.company_name);

    if (!companyName) continue;

    const email = clean(customer.email).toLowerCase();
    const country = clean(customer.country).toLowerCase();
    const key = email || `${companyName.toLowerCase()}|${country}`;

    if (!deduped.has(key)) {
      deduped.set(key, customer);
      continue;
    }

    const existing = deduped.get(key) || emptyCustomer();

    deduped.set(key, {
      ...existing,
      ...customer,
      notes: [clean(existing.notes), clean(customer.notes)]
        .filter(Boolean)
        .join(" | "),
    });
  }

  return Array.from(deduped.values());
}

async function uploadImportFile(params: {
  supabase: any;
  buffer: Buffer;
  filename: string;
  contentType: string;
}) {
  const { supabase, buffer, filename, contentType } = params;

  const storagePath = `customer-imports/${Date.now()}-${safeFileName(
    filename
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("oc-documents")
    .upload(storagePath, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("oc-documents")
    .getPublicUrl(storagePath);

  if (!data.publicUrl) {
    throw new Error("Could not create public URL for uploaded customer file");
  }

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}

async function downloadText(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download converted text: ${response.status}`);
  }

  return response.text();
}

async function convertFileToText(params: {
  fileUrl: string;
  inputFormat: string;
}) {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CLOUDCONVERT_API_KEY");
  }

  const cloudConvert = new CloudConvert(apiKey);

  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-file": {
        operation: "import/url",
        url: params.fileUrl,
      },
      "convert-to-text": {
        operation: "convert",
        input: "import-file",
        input_format: params.inputFormat,
        output_format: "txt",
      },
      "export-text": {
        operation: "export/url",
        input: "convert-to-text",
        inline: false,
        archive_multiple_files: false,
      },
    },
  });

  const completedJob = await cloudConvert.jobs.wait(job.id);

  const exportTask = completedJob.tasks?.find(
    (task: any) => task.name === "export-text"
  );

  const textUrl = exportTask?.result?.files?.[0]?.url;

  if (!textUrl) {
    throw new Error("CloudConvert did not return converted text");
  }

  return downloadText(textUrl);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("customer_file") as File | null;

    if (!file) {
      return NextResponse.redirect(
        new URL(
          `/customers?error=${encodeURIComponent("Missing customer file")}`,
          req.url
        ),
        { status: 303 }
      );
    }

    const fileName = file.name;
    const fileType = file.type || fileExtension(file.name);
    const extension = fileExtension(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const uploaded = await uploadImportFile({
      supabase,
      buffer,
      filename: file.name,
      contentType: file.type,
    });

    let rawText = "";

    if (isDirectTextFile(extension, file.type)) {
      rawText = buffer.toString("utf8");
    } else {
      rawText = await convertFileToText({
        fileUrl: uploaded.publicUrl,
        inputFormat: extension,
      });
    }

    if (!rawText.trim()) {
      return NextResponse.redirect(
        new URL(
          `/customers?error=${encodeURIComponent(
            "Could not extract readable text from file"
          )}`,
          req.url
        ),
        { status: 303 }
      );
    }

    const parsed = parseCustomersWithoutAI(rawText);

    if (parsed.customers.length === 0) {
      return NextResponse.redirect(
        new URL(
          `/customers?error=${encodeURIComponent(
            "No customers could be detected. Try uploading CSV, Excel, Word, or a clearer PDF."
          )}`,
          req.url
        ),
        { status: 303 }
      );
    }

    const { data: draft, error: draftError } = await supabase
      .from("customer_import_drafts")
      .insert({
        file_name: fileName,
        storage_path: uploaded.storagePath,
        file_type: fileType,
        detected_count: parsed.detectedCount,
        customers: parsed.customers,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (draftError || !draft) {
      return NextResponse.redirect(
        new URL(
          `/customers?error=${encodeURIComponent(
            draftError?.message || "Failed to create customer import draft"
          )}`,
          req.url
        ),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      new URL(`/customers/import-preview?draft=${draft.id}`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Failed to import customers"
        )}`,
        req.url
      ),
      { status: 303 }
    );
  }
}