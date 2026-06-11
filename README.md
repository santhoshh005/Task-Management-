# Task Management App

A professional task management web application built with Next.js. It includes secure authentication, task CRUD operations, status-based workflow tracking, and a responsive interface for desktop and mobile.
## Features

- Email and password authentication with session cookies
- Create, edit, and delete tasks
- Move tasks across `to do`, `in progress`, and `done`
- Real-time task refresh using server-sent events
- Responsive layout for desktop and mobile screens

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zod for validation

## Project Structure

- `src/app` - App Router pages, layouts, and API routes
- `src/components` - Client-side dashboard and form UI
- `src/lib` - Auth, storage, validation, realtime, and type helpers
- `.data` - Local runtime storage for users, sessions, and tasks

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build

```bash
npm run build
```

### Start production server

```bash
npm start
```

### Lint the codebase

```bash
npm run lint
```

## GitHub Ready Notes

- Generated app data is stored in `.data/` and should not be committed.
- Environment files matching `.env*` are ignored by default.
- The repository includes `package-lock.json` for reproducible installs.

## Deployment

This project can be deployed on Vercel or any platform that supports Next.js.

## License

No license has been specified yet.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
