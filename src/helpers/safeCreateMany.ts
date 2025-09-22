
// safeCreateMany => chunked + retry
export async function safeCreateMany(
  model: any,   // prisma model jaise prisma.contract
  data: any[],
  chunkSize = 500,
  retries = 3
) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    let attempt = 0;
    while (attempt < retries) {
      try {
        await model.createMany({
          data: chunk,
          skipDuplicates: true, // optional
        });
        break; // agar successful ho gaya to retry loop se nikal jao
      } catch (err: any) {
        if (err.message.includes("Lock wait timeout")) {
          attempt++;
          console.warn(`Retrying chunk (attempt ${attempt})...`);
          await new Promise((res) => setTimeout(res, 1000)); // 1s wait karke retry
        } else {
          throw err;
        }
      }
    }
  }
}
