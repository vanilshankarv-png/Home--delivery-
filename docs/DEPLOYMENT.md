# Deployment Guide

## Render (API)

1. Create a new Web Service in Render.
2. Connect the repository and point Render to the `server` folder.
3. Use the following environment variables:
   - `PORT=5000`
   - `MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/home-delivery`
   - `JWT_SECRET=<long-random-secret>`
   - `JWT_EXPIRES_IN=7d`
   - `CLIENT_URL=https://your-frontend-url.vercel.app`
   - `MOCK_PAYMENTS=true`
   - `RAZORPAY_KEY_ID=<prod-key>`
   - `RAZORPAY_KEY_SECRET=<prod-secret>`
   - `CLOUDINARY_CLOUD_NAME=<cloud-name>`
   - `CLOUDINARY_API_KEY=<api-key>`
   - `CLOUDINARY_API_SECRET=<api-secret>`
4. Build command: `npm install`
5. Start command: `npm run start`

## Vercel (Client)

1. Import the repository into Vercel.
2. Set the project root to the `client` folder.
3. Configure the environment variables:
   - `VITE_API_URL=https://your-render-api-url/api`
   - `VITE_SOCKET_URL=https://your-render-api-url`
   - `VITE_RAZORPAY_KEY_ID=<prod-key>`
4. Build command: `npm run build`
5. Output directory: `dist`

## MongoDB Atlas

1. Create a MongoDB Atlas cluster.
2. Create a database user and whitelist the Render/Vercel IPs or allow all IPs during setup.
3. Copy the connection string into `MONGO_URI`.
4. Use a dedicated database such as `home-delivery`.
5. Enable backups and monitoring before production launch.

## Production checklist

- Set `NODE_ENV=production`
- Replace all demo secrets and keys
- Enable HTTPS on both front-end and API
- Review CORS, auth, and rate-limit configuration
- Seed an admin account and verify roles
- Test payment, messaging, and tracking flows in production mode
