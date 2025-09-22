export function generateCode(length: number, minRange: number, maxRange: number, contain: string): string {
  let characters = "";
  let code = "";

  // Define the range of characters based on the provided specifications
  if (contain === "numbers") {
    characters = "0123456789";
  } else if (contain === "letters") {
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  } else {
    characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  }

  // Generate the code by selecting random characters from the defined range
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange);
  }

  return code;
}