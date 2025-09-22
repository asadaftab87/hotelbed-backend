import crypto from 'crypto';
export const generateTokenKey = (bytes = 64, algo: 'hex' = 'hex') => {
    return crypto.randomBytes(bytes).toString(algo)
}
