# LearnMatch Client

The LearnMatch client is a React application built with Vite and Tailwind CSS.

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set the backend URL when needed. The local default is:

   ```env
   VITE_API_URL=http://localhost:5000
   ```

3. Start the development server:

   ```powershell
   npm run dev
   ```

## Checks

```powershell
npm run lint
npm run build
```

The production build is written to `dist/`, which is generated and excluded from Git.
