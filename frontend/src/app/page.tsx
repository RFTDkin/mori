import MoriInterface from '../components/MoriInterface';

export default function Home() {
  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none z-50">
        <div className="w-full h-full border-[1px] border-hud-border opacity-50 m-2 rounded-xl" style={{ width: 'calc(100% - 16px)', height: 'calc(100% - 16px)' }}></div>
      </div>
      <MoriInterface />
    </main>
  );
}
