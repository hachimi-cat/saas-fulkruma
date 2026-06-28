'use client';

// F-014: portal product detail page. The Deliveries page links a
// product here instead of the products list.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArrowLeft, Loader2, Package, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';

interface FProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: string;
  licenseEnabled: boolean;
  maxActivations: number;
  archived: boolean;
  externalRef: string | null;
  externalSource: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  variants: { id: string; name: string; sku: string | null; isDefault: boolean; archived: boolean }[];
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<FProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    api<{ product: FProduct }>(`/products/${id}`)
      .then((d) => setProduct(d.product))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function handleArchive() {
    if (!product) return;
    if (!confirm(`Archive "${product.name}"? Stock + history are kept.`)) return;
    setArchiving(true);
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      router.push('/dashboard/products');
    } catch (e) {
      setError((e as Error).message);
      setArchiving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="text-xs text-muted-foreground">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Products
        </Link>
        {product && (
          <>
            <span className="mx-1.5 text-muted-foreground/50">/</span>
            <span className="text-foreground">{product.name}</span>
          </>
        )}
      </nav>

      {!product && !error && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {product && (
        <>
          <PageHeader
            title={product.name}
            action={
              <>
                <Link
                  href={`/dashboard/products?edit=${product.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={archiving || product.archived}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                  {product.archived ? 'Archived' : 'Archive'}
                </button>
              </>
            }
          />

          <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{product.type}</span>
                {product.archived && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
                )}
                {product.licenseEnabled && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    License · {product.maxActivations} activation{product.maxActivations === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {product.description && (
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{product.description}</p>
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Type</dt>
                <dd className="capitalize">{product.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">SKU</dt>
                <dd>{product.sku || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Product ID</dt>
                <dd className="font-mono text-xs break-all">{product.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd className="text-xs">
                  {product.externalSource ?? 'Fulkruma'}
                  {product.externalRef ? ` · ${product.externalRef}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd>{new Date(product.createdAt).toLocaleDateString()}</dd>
              </div>
              {product.type === 'physical' && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Shipping dimensions</dt>
                  <dd className="text-xs">
                    {product.weight ?? '—'} g · {product.length ?? '—'}×{product.width ?? '—'}×
                    {product.height ?? '—'} cm
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {product.variants.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Variants ({product.variants.length})</h2>
              <ul className="space-y-1.5">
                {product.variants.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {v.name}
                      {v.isDefault && (
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px]">Default</span>
                      )}
                      {v.archived && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{v.sku || '—'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
