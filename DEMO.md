# Home Delivery Demo Script

Follow these steps to run a complete customer journey in the app.

1. Open the app at http://localhost:5173.
2. Create a customer account:
   - Go to /register
   - Register with a demo email and password such as `customer@example.com` / `Password123!`
3. Log in as the new customer.
4. Search for available services:
   - Go to /search
   - Search for `plumbing`, `cleaning`, or `repair`
   - Filter by category and price range if needed
5. View a service detail page and request a quote:
   - Open a service card
   - Click `Get Quote`
   - Confirm the pricing estimate or change location/date
6. Book the service:
   - Select a time slot
   - Add notes for the provider
   - Submit the booking
7. Log in as a provider user or switch to a seeded provider account.
8. Accept the incoming booking:
   - Open provider jobs dashboard
   - Accept the booking request
9. Simulate live tracking:
   - Open the booking tracking screen
   - Update provider location via the mock tracker
   - Confirm ETAs and tracking events
10. Open the chat panel and send a message to the customer.
11. Mark the job as complete from the provider side.
12. Complete payment:
   - Open the booking checkout or payment history flow
   - Confirm the mocked payment flow
13. Leave a rating/review for the provider.
14. Check customer and provider dashboards for updated metrics and bookings history.

## Example seeded account values

- Customer: `customer@example.com` / `Password123!`
- Provider: `provider@example.com` / `Password123!`
- Admin: `admin@example.com` / `Password123!`

Use the signup and login flows to validate the full end-to-end journey before deployment.
