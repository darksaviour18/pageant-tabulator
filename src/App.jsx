import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <div className="text-center py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          Welcome to Pageant Tabulator Pro
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Real-time scoring and consolidation for live pageantry events.
          Configure your event, manage judges, and tabulate scores — all offline on your local network.
        </p>
      </div>
    </Layout>
  );
}
