import Header from '@/src/components/Header';
import FilterBar from '@/src/components/FilterBar';
import ChannelTable from '@/src/components/ChannelTable';
import GrowthChart from '@/src/components/GrowthChart';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header />
      <FilterBar />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
        <GrowthChart />
        <ChannelTable />
      </main>
    </div>
  );
}
