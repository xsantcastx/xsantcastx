import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, doc, setDoc, getDocs,
  deleteDoc, query, orderBy, Timestamp
} from '@angular/fire/firestore';
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
  private firestore = inject(Firestore);

  private ref(uid: string) {
    return collection(this.firestore, `users/${uid}/catalogs`);
  }

  async save(
    uid: string,
    id: string,
    name: string,
    config: CatalogPdfConfig,
    sections: ProductSection[],
    fieldConfigs: FieldConfig[]
  ): Promise<void> {
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

    await setDoc(doc(this.firestore, `users/${uid}/catalogs/${id}`), {
      id,
      name,
      savedAt: Timestamp.now(),
      config,
      sections: stripped,
      fieldConfigs,
    });
  }

  async list(uid: string): Promise<CloudCatalog[]> {
    const snap = await getDocs(query(this.ref(uid), orderBy('savedAt', 'desc')));
    return snap.docs.map(d => d.data() as CloudCatalog);
  }

  async remove(uid: string, catalogId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `users/${uid}/catalogs/${catalogId}`));
  }
}
