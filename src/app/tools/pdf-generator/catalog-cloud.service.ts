import { Injectable, inject } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { LazyFirestoreService, FirestoreHandle } from '../../shared/lazy-firestore.service';
import { CatalogPdfConfig, FieldConfig, ProductSection } from './pdf-generator.types';

export interface CloudCatalog {
  id: string;
  name: string;
  savedAt: Timestamp;
  config: CatalogPdfConfig;
  sections: ProductSection[];
  fieldConfigs: FieldConfig[];
}

@Injectable({ providedIn: 'root' })
export class CatalogCloudService {
  private lazyFirestore = inject(LazyFirestoreService);

  /** Cloud catalogs are only reachable behind Google sign-in, so the SDK is
   *  already warm by the time any of these run — but it is still fetched on
   *  demand rather than shipped in the initial bundle. */
  private async handle(): Promise<FirestoreHandle> {
    const handle = await this.lazyFirestore.get();
    if (!handle) {
      throw new Error('Cloud catalogs are unavailable — Firestore failed to load.');
    }
    return handle;
  }

  async save(
    uid: string,
    id: string,
    name: string,
    config: CatalogPdfConfig,
    sections: ProductSection[],
    fieldConfigs: FieldConfig[]
  ): Promise<void> {
    const { db, api } = await this.handle();

    // Strip image data before sending to Firestore (Firestore 1 MB doc limit)
    const stripped = sections.map(s => ({
      ...s,
      products: s.products.map(p => ({
        ...p,
        images: p.images.map(({ file: _f, dataUrl: _d, ...meta }) => ({
          ...meta,
          dataUrl: '',
          file: null,
        })),
      })),
    }));

    await api.setDoc(api.doc(db, `users/${uid}/catalogs/${id}`), {
      id,
      name,
      savedAt: api.Timestamp.now(),
      config,
      sections: stripped,
      fieldConfigs,
    });
  }

  async list(uid: string): Promise<CloudCatalog[]> {
    const { db, api } = await this.handle();
    const snap = await api.getDocs(
      api.query(api.collection(db, `users/${uid}/catalogs`), api.orderBy('savedAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as CloudCatalog);
  }

  async remove(uid: string, catalogId: string): Promise<void> {
    const { db, api } = await this.handle();
    await api.deleteDoc(api.doc(db, `users/${uid}/catalogs/${catalogId}`));
  }
}
