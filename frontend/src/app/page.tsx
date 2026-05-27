import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to login page
  redirect('/login');
}
