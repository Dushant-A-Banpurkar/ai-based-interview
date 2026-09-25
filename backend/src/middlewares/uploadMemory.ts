import multer from "multer";

const storage = multer.memoryStorage();
export const uploadMemory = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
