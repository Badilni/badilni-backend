import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  ServiceRequestParams,
  ServiceRequestQuery,
} from './serviceRequest.schema.js';
import * as serviceRequestService from './serviceRequest.service.js';

const getUploadedFiles = (files: Express.Multer.File[] | undefined) => files;

export const createServiceRequest = asyncHandler(async (req, res, _next) => {
  const serviceRequest = await serviceRequestService.createServiceRequest(
    req.user!.id,
    req.body,
    getUploadedFiles(req.files as Express.Multer.File[] | undefined),
  );

  res.status(201).json({ status: 'success', data: { serviceRequest } });
});

export const getServiceRequest = asyncHandler(async (req, res, _next) => {
  const serviceRequest = await serviceRequestService.getServiceRequest(
    (req.params as ServiceRequestParams).id,
    req.query,
  );

  res.status(200).json({ status: 'success', data: { serviceRequest } });
});

export const getAllServiceRequests = asyncHandler(async (req, res, _next) => {
  if (req.params.userId) {
    req.query.user = req.params.userId;
  }

  const { docs: serviceRequests, pagination } =
    await serviceRequestService.getAllServiceRequests(
      req.query as unknown as ServiceRequestQuery,
    );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { serviceRequests },
  });
});

export const updateServiceRequest = asyncHandler(async (req, res, _next) => {
  const serviceRequest = await serviceRequestService.updateServiceRequest(
    (req.params as ServiceRequestParams).id,
    req.user!,
    req.body,
    getUploadedFiles(req.files as Express.Multer.File[] | undefined),
  );

  res.status(200).json({ status: 'success', data: { serviceRequest } });
});

export const deleteServiceRequest = asyncHandler(async (req, res, _next) => {
  await serviceRequestService.deleteServiceRequest(
    (req.params as ServiceRequestParams).id,
    req.user!,
  );

  res.sendStatus(204);
});
