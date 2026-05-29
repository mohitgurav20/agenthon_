import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to landing page
  redirect('/index.html');
}
