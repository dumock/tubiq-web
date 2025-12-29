import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import ChannelTable from '@/components/ChannelTable';
import GrowthChart from '@/components/GrowthChart';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header />
      <FilterBar showCountryFilter={true} />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
        <GrowthChart />
        <ChannelTable />
      </main>
    </div>
  );
}
