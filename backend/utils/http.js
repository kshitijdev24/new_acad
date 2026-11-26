import multer from 'multer';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const sendSuccess = (res, message, data, status = 200) =>
  res.status(status).json({ success: true, message, data });

export function requireFeatureAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      data: null,
    });
  }
  return next();
}

export function featureErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A resource with these details already exists.',
      data: null,
    });
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Each uploaded file must be 20 MB or smaller.'
        : 'The uploaded files do not meet the upload limits.',
      data: null,
    });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: error.issues[0]?.message || 'The request is invalid.',
      data: { issues: error.issues },
    });
  }

  const status = Number(error.status) || 500;
  if (status >= 500) {
    console.error(`[PYQ API] ${error.message || 'Unexpected request failure.'}`);
  }
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'The PYQ request could not be completed.' : error.message,
    data: null,
  });
}
