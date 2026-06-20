export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 1500
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || "";
      const isRetryable =
        errorMessage.includes("503") ||
        errorMessage.includes("429") ||
        errorMessage.includes("high demand") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("network error") ||
        errorMessage.includes("fetch failed");

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[Retry ${attempt}/${maxRetries}] AI service temporarily unavailable. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Maximum retries reached");
}
