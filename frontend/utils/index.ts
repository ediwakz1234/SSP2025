export interface Business {
    id: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    address: string;
    cluster?: number;
}

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone_number?: string;
    address: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    organization: string;
    position: string;
    bio: string;
    profileImage?: string;
    date_of_birth?: string;

}

export interface Cluster {
    id: number;
    centroid: { lat: number; lng: number };
    businesses: Business[];
    color: string;
}

export interface ClusterResult {
    clusters: Cluster[];
    iterations: number;
    convergence: number;
}
