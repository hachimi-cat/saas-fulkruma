import { Warehouse, Boxes, Truck, KeyRound } from 'lucide-react';

const stats = [
  { label: 'Active warehouses', value: '0', icon: Warehouse },
  { label: 'SKUs tracked', value: '0', icon: Boxes },
  { label: 'Shipments in transit', value: '0', icon: Truck },
  { label: 'Active licenses', value: '0', icon: KeyRound },
];

export default function DashboardHome() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock, shipping, and fulfilment for your storefront. Phase 0 scaffolding —
          no data wired yet.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <Icon size={16} className="text-muted-foreground" strokeWidth={2} />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <h2 className="text-base font-semibold">Connect a Storlaunch storefront</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Once Storlaunch enables the Fulkruma module on your account, your
          warehouses and shipments populate here automatically.
        </p>
      </section>
    </div>
  );
}
