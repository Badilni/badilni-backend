import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const uploadImage = async (
  file: Express.Multer.File,
  cloudinaryFolder: string,
): Promise<UploadApiResponse> => {
  return new Promise((res, rej) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryFolder,
      },
      (err, result) => {
        if (err) {
          return rej(err);
        }
        res(result!);
      },
    );

    uploadStream.end(file.buffer);
  });
};

export const deleteImage = async (publicId: string) =>
  await cloudinary.uploader.destroy(publicId);
