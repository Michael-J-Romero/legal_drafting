import dynamic from 'next/dynamic';

const LegalDraftingApp = dynamic(() => import('../components/LegalDraftingApp'), {
  ssr: false,
});

export default function HomePage() {
  return <LegalDraftingApp />;
}
