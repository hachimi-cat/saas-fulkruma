'use client';

// F-014: portal product detail page. The Deliveries page links a
// product here instead of the products list.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import { api } from '@/lib/api';

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
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<FProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ product: FProduct }>(`/products/${id}`)
      .then((d) => setProduct(d.product))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Products
      </Link>

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
          <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold break-words">{product.name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
        </>
      )}
    </div>
  );
}
