import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  DocumentData,
  WhereFilterOp,
  OrderByDirection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface QueryFilter {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderByField?: string;
  orderDirection?: OrderByDirection;
  limitCount?: number;
  // Use in-memory sorting to avoid composite index requirements
  sortInMemory?: boolean;
}

export abstract class BaseRepository<T extends { id: string }> implements IRepository<T> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  protected abstract fromFirestore(id: string, data: DocumentData): T;

  protected getCollectionRef() {
    return collection(db, this.collectionName);
  }

  protected getDocRef(id: string) {
    return doc(db, this.collectionName, id);
  }

  async findById(id: string): Promise<T | null> {
    const docRef = this.getDocRef(id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.fromFirestore(docSnap.id, docSnap.data());
  }

  async findAll(): Promise<T[]> {
    const querySnapshot = await getDocs(this.getCollectionRef());
    return querySnapshot.docs.map((doc) => this.fromFirestore(doc.id, doc.data()));
  }

  async findWithQuery(options: QueryOptions): Promise<T[]> {
    const constraints: QueryConstraint[] = [];
    const hasMultipleFilters = options.filters && options.filters.length > 1;
    const shouldSortInMemory = options.sortInMemory ?? hasMultipleFilters;

    if (options.filters) {
      for (const filter of options.filters) {
        constraints.push(where(filter.field, filter.operator, filter.value));
      }
    }

    // Only use Firestore orderBy if we have 0-1 filters (no composite index needed)
    if (options.orderByField && !shouldSortInMemory) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || "asc"));
    }

    if (options.limitCount && !shouldSortInMemory) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(this.getCollectionRef(), ...constraints);
    const querySnapshot = await getDocs(q);

    let results = querySnapshot.docs.map((doc) => this.fromFirestore(doc.id, doc.data()));

    // Sort in memory if needed to avoid composite indexes
    if (options.orderByField && shouldSortInMemory) {
      const field = options.orderByField;
      const direction = options.orderDirection || "asc";
      results.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[field];
        const bVal = (b as Record<string, unknown>)[field];
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Apply limit in memory if needed
    if (options.limitCount && shouldSortInMemory) {
      results = results.slice(0, options.limitCount);
    }

    return results;
  }

  async create(data: Omit<T, "id">): Promise<T> {
    const docRef = await addDoc(this.getCollectionRef(), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const created = await this.findById(docRef.id);
    if (!created) {
      throw new Error("Failed to create document");
    }

    return created;
  }

  async createWithId(id: string, data: Omit<T, "id">): Promise<T> {
    const docRef = this.getDocRef(id);
    const { setDoc } = await import("firebase/firestore");

    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to create document");
    }

    return created;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = this.getDocRef(id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  async delete(id: string): Promise<void> {
    const docRef = this.getDocRef(id);
    await deleteDoc(docRef);
  }

  async exists(id: string): Promise<boolean> {
    const docRef = this.getDocRef(id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }
}
