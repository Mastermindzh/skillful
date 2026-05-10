export async function toUploadPayload(file: File, readErrorMessage: string) {
  const contentBase64 = await readFileAsBase64(file, readErrorMessage);
  return {
    name: file.name,
    contentBase64,
  };
}

async function readFileAsBase64(file: File, readErrorMessage: string) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(readErrorMessage));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(readErrorMessage));
        return;
      }

      const [, contentBase64 = ""] = reader.result.split(",", 2);
      resolve(contentBase64);
    };
    reader.readAsDataURL(file);
  });
}
