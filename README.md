# XSMART TV Backend

Backend persistent storage for XSMART TV React App using Node.js, Express, and MySQL.

## Prerequisites
- Node.js installed
- MySQL Server installed and running

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file from the `test.env` template.
   - Update `DB_USER`, `DB_PASS`, and `DB_NAME` to match your MySQL configuration.

4. Initialize the database:
   - Run the `schema.sql` script in your MySQL client to create the database and tables.

## Running the Server

- To start the server in development mode:
   ```bash
   npm run dev
   ```

- To start the server in production mode:
   ```bash
   npm start
   ```

The server will run on `http://localhost:5000`.

## Features
- JWT Authentication (Login/Register)
- Persistent Favorites across movies, series, and live TV.
- Watch History with progress tracking.
- Subscription duration management and expiry alerts.
