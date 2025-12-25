/**
 * Utility functions for handling image URLs in the application
 */

const STORAGE_BASE_URL = 'https://sahtee.evra-co.com/storage';

/**
 * Builds a complete URL for a license image path
 * Handles both relative and absolute paths
 * @param licensePath - The license image path (can be relative or absolute URL)
 * @returns Complete URL string or null if path is invalid
 */
export const getLicenseImageUrl = (licensePath?: string | null): string | null => {
    if (!licensePath || licensePath.trim() === '') {
        return null;
    }

    // If it's already a full URL, return it as is
    if (licensePath.startsWith('http://') || licensePath.startsWith('https://')) {
        return licensePath;
    }

    // Clean the path: remove leading slashes and normalize
    const cleanPath = licensePath.replace(/^\/+/, '').trim();
    
    if (cleanPath === '') {
        return null;
    }

    // Build the full URL
    return `${STORAGE_BASE_URL}/${cleanPath}`;
};

/**
 * Builds a complete URL for a profile image path
 * @param profileImagePath - The profile image path (can be relative or absolute URL)
 * @returns Complete URL string or null if path is invalid
 */
export const getProfileImageUrl = (profileImagePath?: string | null): string | null => {
    if (!profileImagePath || profileImagePath.trim() === '') {
        return null;
    }

    // If it's already a full URL, return it as is
    if (profileImagePath.startsWith('http://') || profileImagePath.startsWith('https://')) {
        return profileImagePath;
    }

    // Clean the path: remove leading slashes and normalize
    const cleanPath = profileImagePath.replace(/^\/+/, '').trim();
    
    if (cleanPath === '') {
        return null;
    }

    // Build the full URL
    return `${STORAGE_BASE_URL}/${cleanPath}`;
};

/**
 * Validates if a URL is valid and accessible
 * @param url - The URL to validate
 * @returns Promise that resolves to true if URL is valid, false otherwise
 */
export const validateImageUrl = async (url: string | null): Promise<boolean> => {
    if (!url) return false;

    try {
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        // In no-cors mode, we can't check status, but if no error is thrown, assume it's valid
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Builds a complete URL for a specialization image path
 * Tries multiple possible paths to handle different server configurations
 * @param imagePath - The specialization image path (can be relative or absolute URL)
 * @returns Complete URL string or null if path is invalid
 */
export const getSpecializationImageUrl = (imagePath?: string | null): string | null => {
    if (!imagePath || imagePath.trim() === '') {
        return null;
    }

    // If it's already a full URL, return it as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }

    // Remove leading slashes and 'storage/' prefix if they exist
    let cleanPath = imagePath.replace(/^\/+/, '').replace(/^storage\//, '');
    
    if (cleanPath === '') {
        return null;
    }

    // Priority 1: If the path already starts with specializations/, use it directly
    // This handles cases like "specializations/dermatology.png"
    if (cleanPath.startsWith('specializations/')) {
        return `${STORAGE_BASE_URL}/${cleanPath}`;
    }

    // Priority 2: If it starts with images/specializations/, use it directly
    if (cleanPath.startsWith('images/specializations/')) {
        return `${STORAGE_BASE_URL}/${cleanPath}`;
    }

    // Priority 3: If the path contains a directory structure (has '/'), use it as is
    // This handles any other directory structure
    if (cleanPath.includes('/')) {
        return `${STORAGE_BASE_URL}/${cleanPath}`;
    }

    // Priority 4: If it's just a filename, try the most common path first
    // Browser will try alternatives via onError handler if this fails
    return `${STORAGE_BASE_URL}/images/specializations/${cleanPath}`;
};

/**
 * Encodes a path component to ensure safe URL construction
 * @param path - The path component to encode
 * @returns Encoded path
 */
export const encodeImagePath = (path: string): string => {
    // Split by '/' and encode each segment separately
    return path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
};

/**
 * Fetches doctor license image from API and converts it to a blob URL
 * The license image is not public and requires authentication
 * @param doctorId - The doctor ID
 * @param api - The API service instance
 * @returns Promise that resolves to blob URL string or null if failed
 */
export const getDoctorLicenseFromApi = async (
    doctorId: number | string,
    api: any
): Promise<string | null> => {
    try {
        const blob = await api.getDoctorLicense(doctorId);
        if (blob instanceof Blob) {
            return URL.createObjectURL(blob);
        }
        // إذا كان null (مثل 404)، نعيد null
        return null;
    } catch (error) {
        console.error('Error fetching doctor license from API:', error);
        return null;
    }
};

/**
 * Fetches nurse license image from API and converts it to a blob URL
 * The license image is not public and requires authentication
 * @param nurseId - The nurse ID
 * @param api - The API service instance
 * @returns Promise that resolves to blob URL string or null if failed
 */
export const getNurseLicenseFromApi = async (
    nurseId: number | string,
    api: any
): Promise<string | null> => {
    try {
        const blob = await api.getNurseLicense(nurseId);
        if (blob instanceof Blob) {
            return URL.createObjectURL(blob);
        }
        // إذا كان null (مثل 404)، نعيد null
        return null;
    } catch (error) {
        console.error('Error fetching nurse license from API:', error);
        return null;
    }
};

