export const generateOTP = () => {
  return JSON.stringify(Math.floor(1000 + Math.random() * 9000))
}