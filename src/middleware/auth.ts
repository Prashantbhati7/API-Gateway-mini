import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtUser } from '../types/gateway.js';
import { ApiError } from '../utils/ApiError.js';

const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Unauthorized: No token provided');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ApiError(401, 'Unauthorized: Malformed Authorization header');
    }
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new ApiError(500, 'Server misconfiguration: JWT_SECRET not set');
    }
    const decoded = jwt.verify(token, secret) as JwtUser;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(401, 'Unauthorized: Invalid or expired token'));
  }
};

export default authMiddleware;
