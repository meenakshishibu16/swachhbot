import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

test('renders the SwachhBot landing page with a WhatsApp CTA', () => {
  render(<LandingPage onOpenDashboard={() => {}} />);

  expect(screen.getByRole('heading', { name: /SwachhBot turns everyday civic complaints/i })).toBeInTheDocument();
  expect(screen.getByText(/Autonomous civic grievance resolution/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /chat on whatsapp/i })).toHaveAttribute(
    'href',
    'https://wa.me/14155238886?text=join%20dark-comfortable'
  );
});
