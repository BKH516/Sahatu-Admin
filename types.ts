
export interface Admin {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  roles: { name: string }[];
  role?: string; // للتحكم بالصلاحيات
  permissions?: string[]; // قائمة الصلاحيات
}

export enum AccountStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export interface PendingAccount {
    id: number;
    email: string;
    phone_number: string;
    created_at: string;
    is_approved: AccountStatus;
    doctor?: {
        id: number;
        account_id: number;
        full_name: string;
        profile_description: string;
        profile_image?: string;
        license_image_path?: string;
        address: string;
        age?: number;
        gender?: 'male' | 'female';
        specialization_id?: number;
        specialization?: {
            id: number;
            name_ar: string;
            name_en: string;
        };
    };
    nurse?: {
        id: number;
        account_id: number;
        full_name: string;
        profile_description: string;
        profile_image?: string;
        address: string;
        graduation_type: string;
        age?: number;
        gender?: 'male' | 'female';
    }
}

export interface Specialization {
    id: number;
    name_en: string;
    name_ar: string;
    image: string;
}

export interface HospitalService {
    id: number;
    service_name: string;
    created_at: string;
    updated_at: string;
}

export interface DoctorService {
  id: number;
  doctor_id: number;
  name: string;
  price: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DoctorWorkSchedule {
  id: number;
  doctor_id: number;
  day_of_week: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DoctorReservation {
  id: number;
  user_id: number;
  doctor_service_id: number;
  doctor_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  user?: {
    id?: number;
    account_id?: number;
    age?: number;
    gender?: 'male' | 'female';
    full_name?: string;
    phone_number?: string;
    phone?: string;
    mobile?: string;
    account?: {
      id?: number;
      full_name?: string;
      email?: string;
      phone_number?: string;
      phone?: string;
      mobile?: string;
    };
  };
  doctor_service?: DoctorService;
}

export interface Doctor {
  id: number;
  full_name: string;
  address: string;
  age: number;
  gender: 'male' | 'female';
  profile_description: string;
  account: {
    id?: number;
    email: string;
    phone_number: string;
  };
  specialization: {
    id?: number;
    name_ar: string;
    name_en: string;
  };
  services?: DoctorService[];
  doctor_work_schedule?: DoctorWorkSchedule[];
  reservations_count?: number;
}

export interface Nurse {
  id: number;
  full_name: string;
  address: string;
  age: number;
  gender: 'male' | 'female';
  profile_description: string;
  graduation_type: string;
  is_active: 0 | 1;
  account: {
    email: string;
    phone_number: string;
  };
}

export interface User {
  id: number;
  full_name: string;
  age: number;
  gender: 'male' | 'female';
  account: {
    email: string;
    phone_number: string;
  };
}

export interface HospitalServiceWithPivot {
  id: number;
  service_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  pivot: {
    hospital_id: number;
    service_id: number;
    price: string;
    capacity: number;
  };
}

export interface HospitalWorkSchedule {
  id: number;
  hospital_id: number;
  day_of_week: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  created_at: string;
  updated_at: string;
}

export interface HospitalReservation {
  id: number;
  user_id: number;
  hospital_service_id: number;
  hospital_id: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  user?: {
    id: number;
    full_name: string;
    account: {
      email: string;
      phone_number: string;
    };
  };
  hospital_service?: {
    id: number;
    hospital_id: number;
    service_id: number;
    price: string;
    capacity: number;
    service?: {
      id: number;
      service_name: string;
    };
  };
}

export interface Hospital {
  id: number;
  full_name?: string | null;
  address?: string | null;
  account?: {
    id?: number;
    email?: string | null;
    phone_number?: string | null;
  } | null;
  services_2?: HospitalServiceWithPivot[];
  work_schedule?: HospitalWorkSchedule[];
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
  updated_at: string;
}
