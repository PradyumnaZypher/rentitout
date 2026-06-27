# 📦 RentItOut - Peer-to-Peer Equipment Rental Marketplace

**RentItOut** is a modern, full-featured Peer-to-Peer (P2P) equipment rental marketplace web application. It enables users to easily list their own items for rent (e.g., tools, cameras, outdoor gear, sports equipment) or browse and book items listed by other users. The application features real-time messaging between renters and owners, an interactive dashboard for tracking listings and bookings, and a robust search/filtering engine.

---

## ✨ Features

- **🔍 Search & Filter Engine**: Browse listings by categories (Tools, Cameras, Sports, Electronics, Outdoor, etc.), search queries, location, price, and condition.
- **📅 Interactive Booking & Availability**: A calendar-based booking form that automatically computes total price, enforces minimum/maximum rental periods, and prevents double-booking of unavailable dates.
- **💬 Real-Time Messaging**: Built-in chat interface that allows direct communication between renters and item owners, automatically contextualized by the rental item.
- **📊 Business Dashboard**:
  - **Overview**: High-level metrics showing total listings, active rentals, pending requests, and cumulative earnings.
  - **My Listings**: Create, edit, toggle visibility (activate/deactivate), or delete listings.
  - **My Rentals**: Monitor active rentals, start/end dates, total costs, and current status.
  - **Booking Requests**: Review incoming booking requests from other users with the option to accept or decline.
  - **Profile**: Customize profile details, including name, phone number, bio, city, and avatar.
- **🔐 Secure Authentication**: Integrated with Supabase Auth for registration, login, session persistence, and password recovery, backed by React Router protected routes.
- **🛡️ Database Row Level Security (RLS)**: Fine-grained security policies on all database tables, ensuring users can only edit or view private data they own or participate in.

---

## 🛠️ Tech Stack

- **Frontend Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, and Real-time triggers)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (with persistent storage for active user sessions)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **Form Handling & Validation**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **UI Components & Primitives**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives), [Lucide React](https://lucide.dev/) (icons), [Sonner](https://sonner.emilkowal.ski/) (toast notifications), [Recharts](https://recharts.org/) (dashboard analytics charts), [Embla Carousel](https://www.embla-carousel.com/) (listing image sliders).

---

## 📂 Project Structure

```text
rentitout/
├── .bolt/                  # Bolt.new configuration metadata
├── public/                 # Static assets (images, icons)
├── supabase/               # Database configurations & migrations
│   └── migrations/         # SQL files defining the tables, policies, and triggers
├── src/
│   ├── components/
│   │   ├── auth/           # Auth forms, protected route guards
│   │   ├── layout/         # Navbar, Footer, Dashboard layouts
│   │   ├── listings/       # Listing cards, edit forms, booking widgets
│   │   ├── shared/         # Scroll-to-top and reusable UI pieces
│   │   └── ui/             # Shadcn raw UI primitives (buttons, inputs, etc.)
│   ├── hooks/              # Custom React hooks (e.g., useAuth)
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client instantiation & TS typings
│   │   └── utils.ts        # Helper functions (cn classes merger, currency formatters)
│   ├── pages/
│   │   ├── Dashboard/      # Owner Overview, Listings list, Requests, Profile
│   │   ├── About.tsx       # "About Us" page
│   │   ├── Browse.tsx      # Main item directory with filters
│   │   ├── EditListing.tsx # Modify an existing listing
│   │   ├── Home.tsx        # Hero section, categories, featured items
│   │   ├── ListItem.tsx    # Multi-step "list a new item" form
│   │   ├── ListingDetail.tsx# Public page for viewing listing details
│   │   └── Messages.tsx    # Live messaging dashboard
│   ├── store/
│   │   └── index.ts        # Zustand auth state and global UI stores
│   ├── App.tsx             # Routes definition and layout wrappers
│   ├── index.css           # Tailwind custom tokens & styles
│   └── main.tsx            # App entry point
├── .env                    # Local environment variables (Supabase keys)
├── package.json            # Scripts & dependencies definition
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite bundler options
```

---

## 🚀 How to Run the Project Locally

Follow these step-by-step instructions to get the project running on your local machine.

### 1. Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (Version 18+ recommended)
- [npm](https://www.npmjs.com/) (comes pre-packaged with Node.js)
- A [Supabase Account](https://supabase.com/) (if setting up your own database backend)

---

### 2. Clone and Install Dependencies

1. Navigate to the project root directory in your terminal:
   ```bash
   cd c:/Users/Hp/OneDrive/Desktop/rentitout
   ```
2. Install the package dependencies using `npm`:
   ```bash
   npm install
   ```

---

### 3. Environment Variables Configuration

The project uses a `.env` file to securely connect the frontend to your Supabase project.

Create or update the `.env` file in the root of the project with the following parameters:
```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
```

> [!NOTE]
> The current project already has preconfigured test keys inside `.env` referencing a live Supabase instance. If you want to use the pre-configured instance, you can skip to **Step 5**.

---

### 4. Database Setup (Optional - Custom Supabase Instance)

If you are setting up a clean Supabase database instance:

1. Create a new project in your [Supabase Dashboard](https://database.new).
2. Go to the **SQL Editor** in Supabase.
3. Open and copy the contents of the latest schema migration file located at:
   `supabase/migrations/20260626173112_rentitout_schema.sql`
4. Run the SQL script in your Supabase SQL Editor. This will automatically create:
   - All necessary tables (`profiles`, `listings`, `bookings`, `reviews`, `messages`, `blocked_dates`, `wishlists`).
   - Indexes for fast queries.
   - Row Level Security (RLS) policies.
   - Database trigger functions to automatically create user profiles upon authentication signup.
5. Create a Storage Bucket in Supabase called `listings` and make it public (so listing images can be stored and served).

---

### 5. Running the Development Server

To launch the application locally, run the following command:

```bash
npm run dev
```

This will spin up Vite's local dev server. The terminal will output the local address, typically:
`http://localhost:5173/`

Open this address in your browser to view and interact with **RentItOut**.

---

### 6. Common Scripts

In the project directory, you can run the following package scripts:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs the application in development mode with Hot Module Replacement (HMR). |
| `npm run build` | Runs the TypeScript compiler (`tsc`) and builds the application for production to the `dist/` directory. |
| `npm run typecheck`| Performs static analysis and reports any TypeScript compile-time errors. |
| `npm run preview` | Runs a local server to preview the production build generated by `npm run build`. |
