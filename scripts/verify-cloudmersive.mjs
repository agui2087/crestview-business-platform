const apiKey = process.env.CLOUDMERSIVE_VIRUS_API_KEY?.trim();
if (!apiKey) throw new Error("CLOUDMERSIVE_VIRUS_API_KEY is required. Do not put it on the command line or commit it.");

async function scan(name, bytes, contentType) {
  const form = new FormData();
  form.append("inputFile", new File([bytes], name, { type: contentType }));
  const response = await fetch("https://api.cloudmersive.com/virus/scan/file/advanced", {
    method: "POST",
    headers: {
      Apikey: apiKey,
      allowExecutables: "false",
      allowInvalidFiles: "false",
      allowScripts: "false",
      allowPasswordProtectedFiles: "false",
      allowMacros: "false",
      allowXmlExternalEntities: "false",
      allowInsecureDeserialization: "false",
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cloudmersive verification returned HTTP ${response.status}.`);
  const result = await response.json();
  return { clean: result?.CleanResult === true, foundViruses: Array.isArray(result?.FoundViruses) ? result.FoundViruses.length : 0 };
}

const cleanPdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "utf8");
const antivirusTest = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", "utf8");
const clean = await scan("crestview-clean-verification.pdf", cleanPdf, "application/pdf");
const blocked = await scan("crestview-eicar-verification.txt", antivirusTest, "text/plain");

if (!clean.clean) throw new Error("Cloudmersive did not mark the clean verification file as clean.");
if (blocked.clean) throw new Error("Cloudmersive unexpectedly marked the EICAR verification file as clean.");
console.log(`Cloudmersive verification passed: clean accepted; EICAR rejected with ${blocked.foundViruses} finding(s).`);
