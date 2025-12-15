import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Tag,
  MapPinned,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Download,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Brain,
  AlertTriangle,
  X,
  LucideIcon,
} from 'lucide-react';
import { supabase } from "../../lib/supabase";
import * as api from "../../lib/api-client";
import { toast } from "sonner";
import { logActivity } from "../../utils/activity";



// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Business {
  id: string;
  business_name: string;
  category: string;
  street: string;
  coordinates: string;
  zone_type: string;
  status: 'active' | 'inactive';
}

export type TrainingStatusType = 'idle' | 'training' | 'success' | 'error';

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  bgColor?: string;
}

function StatsCard({ title, value, icon: Icon, bgColor = 'bg-purple-50' }: StatsCardProps) {
  // Map colors to gradients
  const gradientMap: Record<string, { from: string; to: string; textGradient: string }> = {
    'bg-purple-50': { from: 'from-purple-50', to: 'to-violet-50', textGradient: 'from-purple-600 to-violet-600' },
    'bg-blue-50': { from: 'from-blue-50', to: 'to-indigo-50', textGradient: 'from-blue-600 to-indigo-600' },
    'bg-green-50': { from: 'from-green-50', to: 'to-emerald-50', textGradient: 'from-green-600 to-emerald-600' },
  };

  const gradient = gradientMap[bgColor] || gradientMap['bg-purple-50'];

  return (
    <div className={`group relative overflow-hidden bg-linear-to-br ${gradient.from} ${gradient.to} rounded-xl border-0 p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}>
      <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-white/20 blur-2xl group-hover:bg-white/30 transition-colors duration-500"></div>
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium mb-2">{title}</p>
          <p className={`text-3xl font-bold bg-linear-to-r ${gradient.textGradient} bg-clip-text text-transparent`}>{value}</p>
        </div>
        <div className={`bg-linear-to-br ${gradient.textGradient.replace('from-', 'from-').replace('to-', 'to-')} p-3 rounded-xl shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SEARCH FILTERS COMPONENT
// ============================================================================

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  zoneFilter: string;
  onZoneChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categories: string[];
  zones: string[];
}

function SearchFilters({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  zoneFilter,
  onZoneChange,
  statusFilter,
  onStatusChange,
  categories,
  zones,
}: SearchFiltersProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border-0 p-6 shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search Bar */}
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by business name, category, or street..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all duration-300"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 appearance-none bg-white transition-all duration-300 cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Zone Filter */}
        <div className="hidden md:block">
          <select
            value={zoneFilter}
            onChange={(e) => onZoneChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 appearance-none bg-white transition-all duration-300 cursor-pointer"
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Zone & Status Filters */}
      <div className="grid grid-cols-2 gap-4 mt-4 md:hidden">
        <select
          value={zoneFilter}
          onChange={(e) => onZoneChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 appearance-none bg-white transition-all duration-300 cursor-pointer"
        >
          <option value="">All Zones</option>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 appearance-none bg-white transition-all duration-300 cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Desktop Status Filter */}
      <div className="hidden md:block mt-4">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 appearance-none bg-white transition-all duration-300 cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// SEED DATA TABLE COMPONENT
// ============================================================================

interface SeedDataTableProps {
  businesses: Business[];
  onEdit: (business: Business) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, newStatus: 'active' | 'inactive') => void;
}

function SeedDataTable({ businesses, onEdit, onDelete, onToggleStatus }: SeedDataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Business | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // Sorting logic
  const sortedBusinesses = [...businesses].sort((a, b) => {
    if (!sortField) return 0;

    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedBusinesses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBusinesses = sortedBusinesses.slice(startIndex, endIndex);

  const handleSort = (field: keyof Business) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-lg overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-linear-to-r from-gray-50 to-slate-50 border-b border-gray-100">
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort('business_name')}
              >
                <div className="flex items-center gap-2">
                  Business Name
                  <ArrowUpDown className="w-3 h-3 text-purple-500" />
                </div>
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-2">
                  Category
                  <ArrowUpDown className="w-3 h-3 text-purple-500" />
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Coordinates
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort('zone_type')}
              >
                <div className="flex items-center gap-2">
                  Zone Type
                  <ArrowUpDown className="w-3 h-3 text-purple-500" />
                </div>
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  Status
                  <ArrowUpDown className="w-3 h-3 text-purple-500" />
                </div>
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentBusinesses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-gray-100 to-gray-50 mb-4">
                      <Building2 className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">No businesses found</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first business to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentBusinesses.map((business, index) => (
                <tr
                  key={business.id}
                  className="group hover:bg-linear-to-r hover:from-purple-50/50 hover:to-violet-50/50 transition-all duration-300"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors duration-200">{business.business_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-linear-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50">
                      {business.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      {business.street}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm font-mono">{business.coordinates}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-linear-to-r from-purple-100 to-violet-100 text-purple-800 border border-purple-200/50">
                      {business.zone_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() =>
                        onToggleStatus(business.id, business.status === 'active' ? 'inactive' : 'active')
                      }
                      className="group/btn"
                    >
                      {business.status === 'active' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-linear-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200/50 group-hover/btn:from-green-200 group-hover/btn:to-emerald-200 transition-all duration-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200/50 group-hover/btn:bg-gray-200 transition-all duration-200">
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(business)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-all duration-200 hover:scale-105"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(business.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-105"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-linear-to-r from-gray-50 to-slate-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium text-purple-600">{startIndex + 1}</span> to <span className="font-medium text-purple-600">{Math.min(endIndex, businesses.length)}</span> of <span className="font-medium">{businesses.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-600 hover:bg-white hover:shadow-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${currentPage === page
                    ? 'bg-linear-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-gray-600 hover:bg-white hover:shadow-md'
                    }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-600 hover:bg-white hover:shadow-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADD/EDIT BUSINESS MODAL COMPONENT
// ============================================================================

interface AddEditBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (business: Omit<Business, 'id'>) => void;
  business?: Business | null;
  categories: string[];
  zones: string[];
}

function AddEditBusinessModal({
  isOpen,
  onClose,
  onSave,
  business,
  categories,
  zones,
}: AddEditBusinessModalProps) {
  const [formData, setFormData] = useState({
    business_name: '',
    category: '',
    street: '',
    coordinates: '',
    zone_type: '',
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    if (business) {
      setFormData({
        business_name: business.business_name,
        category: business.category,
        street: business.street,
        coordinates: business.coordinates,
        zone_type: business.zone_type,
        status: business.status,
      });
    } else {
      setFormData({
        business_name: '',
        category: categories[0] || '',
        street: '',
        coordinates: '',
        zone_type: zones[0] || '',
        status: 'active',
      });
    }
    // Reset errors when modal opens/closes
    setFormErrors({});
  }, [business, isOpen, categories, zones]);

  // Form errors state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateBusinessForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.business_name.trim()) {
      errors.business_name = "Business name is required";
    } else if (formData.business_name.length < 2) {
      errors.business_name = "Business name must be at least 2 characters";
    }

    if (!formData.category) {
      errors.category = "Please select a category";
    }

    if (!formData.street.trim()) {
      errors.street = "Street address is required";
    }

    if (!formData.coordinates.trim()) {
      errors.coordinates = "Coordinates are required";
    } else {
      // Validate coordinates format
      const coordPattern = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      if (!coordPattern.test(formData.coordinates)) {
        errors.coordinates = "Invalid format. Use: latitude, longitude (e.g., 14.285, 121.412)";
      }
    }

    if (!formData.zone_type) {
      errors.zone_type = "Please select a zone type";
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBusinessForm()) return;

    onSave(formData);
    toast.success(business ? "Business updated successfully!" : "Business added successfully!");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl text-gray-900">{business ? 'Edit Business' : 'Add New Business'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Business Name */}
          <div>
            <label htmlFor="business_name" className="block text-sm text-gray-700 mb-2">
              Business Name *
            </label>
            <input
              type="text"
              id="business_name"
              value={formData.business_name}
              onChange={(e) => {
                setFormData({ ...formData, business_name: e.target.value });
                if (formErrors.business_name) setFormErrors(prev => ({ ...prev, business_name: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${formErrors.business_name ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Enter business name"
            />
            {formErrors.business_name && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.business_name}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                if (formErrors.category) setFormErrors(prev => ({ ...prev, category: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white ${formErrors.category ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {formErrors.category && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.category}
              </p>
            )}
          </div>

          {/* Address/Street */}
          <div>
            <label htmlFor="street" className="block text-sm text-gray-700 mb-2">
              Address / Street *
            </label>
            <input
              type="text"
              id="street"
              value={formData.street}
              onChange={(e) => {
                setFormData({ ...formData, street: e.target.value });
                if (formErrors.street) setFormErrors(prev => ({ ...prev, street: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${formErrors.street ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Enter street address"
            />
            {formErrors.street && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.street}
              </p>
            )}
          </div>

          {/* Coordinates */}
          <div>
            <label htmlFor="coordinates" className="block text-sm text-gray-700 mb-2">
              Coordinates *
            </label>
            <input
              type="text"
              id="coordinates"
              value={formData.coordinates}
              onChange={(e) => {
                setFormData({ ...formData, coordinates: e.target.value });
                if (formErrors.coordinates) setFormErrors(prev => ({ ...prev, coordinates: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${formErrors.coordinates ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g., 14.285, 121.412"
            />
            {formErrors.coordinates && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.coordinates}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Format: latitude, longitude</p>
          </div>

          {/* Zone Type */}
          <div>
            <label htmlFor="zone_type" className="block text-sm text-gray-700 mb-2">
              Zone Type *
            </label>
            <select
              id="zone_type"
              value={formData.zone_type}
              onChange={(e) => {
                setFormData({ ...formData, zone_type: e.target.value });
                if (formErrors.zone_type) setFormErrors(prev => ({ ...prev, zone_type: '' }));
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white ${formErrors.zone_type ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select a zone type</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            {formErrors.zone_type && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors.zone_type}
              </p>
            )}
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-sm text-gray-700 mb-3">Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'active' })}
                className={`flex-1 px-4 py-2.5 rounded-lg transition-colors ${formData.status === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'inactive' })}
                className={`flex-1 px-4 py-2.5 rounded-lg transition-colors ${formData.status === 'inactive'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              {business ? 'Save Changes' : 'Add Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// DATASET ACTIONS COMPONENT
// ============================================================================

interface DatasetActionsProps {
  onRefresh: () => void;
  onDownload: () => void;
  onUpload: (file: File) => void;
  onReset: () => void;
  isLoading?: boolean;
}

function DatasetActions({ onRefresh, onDownload, onUpload, onReset, isLoading = false }: DatasetActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      onUpload(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      alert('Please upload a valid CSV file');
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border-0 p-5 shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700 mr-2">Dataset Actions:</span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-linear-to-r from-gray-100 to-slate-100 hover:from-gray-200 hover:to-slate-200 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 hover:shadow-md"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>

        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-linear-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 rounded-xl transition-all duration-300 border border-blue-200 hover:shadow-md"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>

        <button
          onClick={handleUploadClick}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          <Upload className="w-4 h-4" />
          Upload CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-linear-to-r from-red-100 to-rose-100 hover:from-red-200 hover:to-rose-200 rounded-xl transition-all duration-300 ml-auto border border-red-200 hover:shadow-md"
        >
          <Trash2 className="w-4 h-4" />
          Reset Dataset
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TRAINING STATUS COMPONENT
// ============================================================================

interface TrainingStatusProps {
  status: TrainingStatusType;
  message?: string;
}

function TrainingStatus({ status, message }: TrainingStatusProps) {
  if (status === 'idle') return null;

  const statusConfig = {
    training: {
      icon: Loader2,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      defaultMessage: 'Training ML model... Calculating optimal K-value and enhanced data.',
      animate: true,
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
      defaultMessage: 'Training complete! Model updated successfully.',
      animate: false,
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      defaultMessage: 'Training failed. Please check logs and try again.',
      animate: false,
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 bg-white rounded-lg ${config.iconColor}`}>
          <Brain className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-5 h-5 ${config.iconColor} ${config.animate ? 'animate-spin' : ''}`} />
            <span className={`${config.textColor}`}>
              {status === 'training' && 'ML Training In Progress'}
              {status === 'success' && 'Training Complete'}
              {status === 'error' && 'Training Error'}
            </span>
          </div>
          <p className={`text-sm ${config.textColor}`}>{message || config.defaultMessage}</p>
          {status === 'training' && (
            <div className="mt-3">
              <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONFIRM MODAL COMPONENT
// ============================================================================

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className={`${styles.iconBg} p-2 rounded-lg`}>
              <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
            </div>
            <div>
              <h2 className="text-lg text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{message}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-6 py-2.5 text-white ${styles.buttonBg} rounded-lg transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const _sampleBusinesses: Business[] = [
  {
    id: '1',
    business_name: 'Starbucks Coffee',
    category: 'Cafe',
    street: '123 Main Street',
    coordinates: '40.7128, -74.0060',
    zone_type: 'Commercial',
    status: 'active',
  },
  {
    id: '2',
    business_name: 'Urban Fitness Gym',
    category: 'Fitness',
    street: '456 Oak Avenue',
    coordinates: '40.7580, -73.9855',
    zone_type: 'Residential',
    status: 'active',
  },
  {
    id: '3',
    business_name: 'Tech Solutions Inc',
    category: 'Technology',
    street: '789 Innovation Drive',
    coordinates: '40.7489, -73.9680',
    zone_type: 'Business',
    status: 'active',
  },
  {
    id: '4',
    business_name: 'Green Market',
    category: 'Grocery',
    street: '321 Park Lane',
    coordinates: '40.7614, -73.9776',
    zone_type: 'Commercial',
    status: 'inactive',
  },
  {
    id: '5',
    business_name: 'The Book Haven',
    category: 'Retail',
    street: '654 Library Road',
    coordinates: '40.7549, -73.9840',
    zone_type: 'Commercial',
    status: 'active',
  },
];

// ============================================================================
// CSV PARSING HELPER - Handles quoted values correctly
// ============================================================================
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last value
  result.push(current.trim());

  return result;
}

// ============================================================================
// CATEGORY NORMALIZATION - Maps any category to official categories
// ============================================================================
const OFFICIAL_CATEGORIES = [
  "Retail",
  "Services",
  "Restaurant",
  "Food & Beverages",
  "Merchandise / Trading",
  "Entertainment / Leisure"
];

const CATEGORY_MAPPING: Record<string, string> = {
  // Retail
  "retail": "Retail", "grocery": "Retail", "pharmacy": "Retail", "drugstore": "Retail",
  "convenience store": "Retail", "supermarket": "Retail", "sari-sari": "Retail",
  "loading station": "Retail", "bakery": "Retail", "bakeshop": "Retail",

  // Services
  "services": "Services", "service": "Services", "salon": "Services", "barbershop": "Services",
  "laundry": "Services", "car wash": "Services", "carwash": "Services", "repair": "Services",
  "clinic": "Services", "printing": "Services", "pawnshop": "Services", "tutorial": "Services",
  "pet grooming": "Services", "veterinary": "Services",

  // Restaurant
  "restaurant": "Restaurant", "restaurants": "Restaurant", "eatery": "Restaurant",
  "fast food": "Restaurant", "fastfood": "Restaurant", "diner": "Restaurant",
  "carinderia": "Restaurant", "ihaw": "Restaurant", "grill": "Restaurant",

  // Food & Beverages
  "food & beverages": "Food & Beverages", "food and beverages": "Food & Beverages",
  "f&b": "Food & Beverages", "cafe": "Food & Beverages", "coffee shop": "Food & Beverages",
  "milk tea": "Food & Beverages", "bar": "Food & Beverages", "water refilling": "Food & Beverages",
  "catering": "Food & Beverages", "ice cream": "Food & Beverages",

  // Merchandise / Trading
  "merchandise / trading": "Merchandise / Trading", "merchandise": "Merchandise / Trading",
  "trading": "Merchandise / Trading", "hardware": "Merchandise / Trading",
  "electronics": "Merchandise / Trading", "furniture": "Merchandise / Trading",
  "wholesale": "Merchandise / Trading", "distributor": "Merchandise / Trading",
  "clothing": "Merchandise / Trading", "cellphone": "Merchandise / Trading",

  // Entertainment / Leisure
  "entertainment / leisure": "Entertainment / Leisure", "entertainment": "Entertainment / Leisure",
  "hotel": "Entertainment / Leisure", "resort": "Entertainment / Leisure",
  "gym": "Entertainment / Leisure", "arcade": "Entertainment / Leisure",
  "karaoke": "Entertainment / Leisure", "billiards": "Entertainment / Leisure",

  // Pet-related -> Services
  "pet store": "Services", "pet shop": "Services", "pet supplies": "Services",
  "aquarium": "Services", "pet food": "Services",
};

function normalizeCategory(inputCategory: string): string {
  if (!inputCategory) return "Retail";

  const normalized = inputCategory.trim().toLowerCase();

  // Direct mapping
  if (CATEGORY_MAPPING[normalized]) {
    return CATEGORY_MAPPING[normalized];
  }

  // Check if already official
  const officialMatch = OFFICIAL_CATEGORIES.find(
    cat => cat.toLowerCase() === normalized
  );
  if (officialMatch) return officialMatch;

  // Fuzzy match
  for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Keyword fallback
  if (normalized.includes("food") || normalized.includes("drink") || normalized.includes("beverage")) {
    return "Food & Beverages";
  }
  if (normalized.includes("store") || normalized.includes("shop") || normalized.includes("mart")) {
    return "Retail";
  }
  if (normalized.includes("service") || normalized.includes("repair")) {
    return "Services";
  }

  return "Retail"; // Default
}

// ============================================================================
// MAIN SEED DATA MANAGEMENT COMPONENT
// ============================================================================

export default function SeedDataManagement() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatusType>('idle');
  const [isLoading, setIsLoading] = useState(false);

  // Live stats from database
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [totalZones, setTotalZones] = useState(0);

  // Get unique categories and zones for filters
  const categories = Array.from(new Set(businesses.map((b) => b.category))).sort();
  const zones = Array.from(new Set(businesses.map((b) => b.zone_type))).sort();

  // Filter businesses
  useEffect(() => {
    let filtered = [...businesses];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.business_name.toLowerCase().includes(term) ||
          b.category.toLowerCase().includes(term) ||
          b.street.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter((b) => b.category === categoryFilter);
    }

    // Zone filter
    if (zoneFilter) {
      filtered = filtered.filter((b) => b.zone_type === zoneFilter);
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    setFilteredBusinesses(filtered);
  }, [businesses, searchTerm, categoryFilter, zoneFilter, statusFilter]);

  // Load data from Supabase
  useEffect(() => {
    loadBusinesses();
    loadStats();
  }, []);

  // Load live stats from database
  const loadStats = async () => {
    try {

      // Get total count of businesses
      const { count: businessCount, error: countError } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('❌ Error getting business count:', countError);
        throw countError;
      }
      setTotalBusinesses(businessCount || 0);

      // Get unique categories count
      const { data: categoryData, error: categoryError } = await supabase
        .from('businesses')
        .select('general_category');

      if (categoryError) {
        console.error('❌ Error getting categories:', categoryError);
        throw categoryError;
      }
      const uniqueCategories = new Set(categoryData?.map((row: { general_category: string }) => row.general_category) || []);
      setTotalCategories(uniqueCategories.size);

      // Get unique zone types count
      const { data: zoneData, error: zoneError } = await supabase
        .from('businesses')
        .select('zone_type');

      if (zoneError) {
        console.error('❌ Error getting zone types:', zoneError);
        throw zoneError;
      }
      const uniqueZones = new Set(zoneData?.map((row: { zone_type: string }) => row.zone_type) || []);
      setTotalZones(uniqueZones.size);
    } catch (error) {
      console.error("❌ Error loading stats:", error);
      toast.error("Failed to load statistics");
    }
  };

  const loadBusinesses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*');

      if (error) throw error;

      const mappedBusinesses: Business[] = (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        business_name: row.business_name as string,
        category: row.general_category as string,
        street: row.street as string,
        coordinates: `${row.latitude}, ${row.longitude}`,
        zone_type: row.zone_type as string,
        status: ((row.status as string) || 'active') as 'active' | 'inactive',
      }));

      setBusinesses(mappedBusinesses);
    } catch (error) {
      console.error("Error loading businesses:", error);
      toast.error("Failed to load businesses");
    } finally {
      setIsLoading(false);
    }
  };

  const saveBusinesses = async (updated: Business[]) => {
    try {
      // 1. Delete all existing data (simple overwrite strategy)
      const { error: deleteError } = await supabase
        .from('businesses')
        .delete()
        .neq('id', 0); // Delete all rows where ID is not 0

      if (deleteError) throw deleteError;

      // 2. Prepare rows for insertion (exclude id since it's auto-generated)
      const rows = updated.map((b) => {
        const [lat, lng] = b.coordinates.split(',').map((c) => parseFloat(c.trim()));
        return {
          business_name: b.business_name,
          general_category: b.category,
          street: b.street,
          latitude: lat || 0,
          longitude: lng || 0,
          zone_type: b.zone_type,
          status: b.status || 'active',
        };
      });

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('businesses')
          .insert(rows);

        if (insertError) throw insertError;
      }

      // Refresh stats after saving
      await loadStats();
      toast.success("Data saved successfully");
    } catch (e) {
      console.error("Error saving businesses:", e);
      toast.error("Failed to save changes");
    }
  };


  const _triggerTraining = async () => {
    setTrainingStatus("training");

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      if (token) {
        await api.trainModel(token);
        setTrainingStatus("success");
      } else {
        console.warn("No auth token for training API");
        setTrainingStatus("error");
      }

      setTimeout(() => setTrainingStatus("idle"), 5000);
    } catch (err) {
      console.error("Training error:", err);
      setTrainingStatus("error");
      setTimeout(() => setTrainingStatus("idle"), 5000);
    }
  };


  const handleAddBusiness = (businessData: Omit<Business, "id">) => {
    const newBusiness: Business = {
      ...businessData,
      id: Date.now().toString(),
    };

    const updated = [...businesses, newBusiness];
    setBusinesses(updated);
    saveBusinesses(updated);

    // Log activity for seed data tracking
    logActivity("Business Added", {
      business_name: businessData.business_name,
      category: businessData.category,
      action_type: "seed_data_added"
    });
    // triggerTraining(); // Removed: DB trigger handles this automatically
  };


  const handleEditBusiness = (businessData: Omit<Business, "id">) => {
    if (!editingBusiness) return;

    const updated = businesses.map((b) =>
      b.id === editingBusiness.id
        ? { ...businessData, id: editingBusiness.id }
        : b
    );

    setBusinesses(updated);
    setEditingBusiness(null);
    saveBusinesses(updated);

    // Log activity for seed data tracking
    logActivity("Business Updated", {
      business_name: businessData.business_name,
      category: businessData.category,
      action_type: "seed_data_updated"
    });
    // triggerTraining(); // Removed: DB trigger handles this automatically
  };


  const handleDeleteBusiness = (id: string) => {
    setBusinessToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!businessToDelete) return;

    const businessName = businesses.find(b => b.id === businessToDelete)?.business_name || 'Business';
    const updated = businesses.filter((b) => b.id !== businessToDelete);
    setBusinesses(updated);
    saveBusinesses(updated);
    setBusinessToDelete(null);
    setIsDeleteModalOpen(false);
    toast.success(`"${businessName}" deleted successfully`);

    // Log activity for seed data tracking
    logActivity("Business Deleted", {
      business_name: businessName,
      action_type: "seed_data_deleted"
    });
    // triggerTraining(); // Removed: DB trigger handles this automatically
  };




  const handleToggleStatus = (id: string, newStatus: "active" | "inactive") => {
    const updated = businesses.map((b) =>
      b.id === id ? { ...b, status: newStatus } : b
    );

    const businessName = businesses.find(b => b.id === id)?.business_name || 'Business';
    setBusinesses(updated);
    saveBusinesses(updated);
    toast.info(`"${businessName}" status changed to ${newStatus}`);
    // triggerTraining(); // Removed: DB trigger handles this automatically
  };


  const handleRefresh = () => {
    loadBusinesses();
    loadStats();
  };

  const handleDownload = () => {
    // Convert to CSV
    const headers = ['Business Name', 'Category', 'Street', 'Coordinates', 'Zone Type', 'Status'];
    const rows = businesses.map((b) => [b.business_name, b.category, b.street, b.coordinates, b.zone_type, b.status]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seed-data-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headerLine = lines[0].toLowerCase();

        // Check if this is the standard format with headers
        const hasHeaders = headerLine.includes('business_id') || headerLine.includes('business_name');

        let newBusinesses: Business[] = [];

        if (hasHeaders) {
          // Parse CSV with headers: business_id, business_name, general_category, latitude, longitude, street, zone_type, status
          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

          const getIndex = (name: string) => headers.indexOf(name);
          const idxId = getIndex('business_id');
          const idxName = getIndex('business_name');
          const idxCategory = getIndex('general_category');
          const idxLat = getIndex('latitude');
          const idxLng = getIndex('longitude');
          const idxStreet = getIndex('street');
          const idxZone = getIndex('zone_type');
          const idxStatus = getIndex('status');



          newBusinesses = lines
            .slice(1)
            .filter((line) => line.trim())
            .map((line, index) => {
              const values = parseCSVLine(line); // Use proper CSV parser
              const lat = idxLat >= 0 ? values[idxLat] : '';
              const lng = idxLng >= 0 ? values[idxLng] : '';
              const rawCategory = idxCategory >= 0 ? values[idxCategory] : '';
              const normalizedCategory = normalizeCategory(rawCategory);

              return {
                id: (idxId >= 0 && values[idxId]) ? values[idxId] : (Date.now().toString() + index),
                business_name: idxName >= 0 ? values[idxName] : '',
                category: normalizedCategory, // ✅ NORMALIZE CATEGORY
                street: idxStreet >= 0 ? values[idxStreet] : '',
                coordinates: (lat && lng) ? `${lat}, ${lng}` : '',
                zone_type: idxZone >= 0 ? values[idxZone] : '',
                status: (idxStatus >= 0 && values[idxStatus]?.toLowerCase() === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
              };
            });
        } else {
          // Legacy format: business_name, category, street, coordinates, zone_type, status
          newBusinesses = lines
            .slice(1)
            .filter((line) => line.trim())
            .map((line, index) => {
              const values = parseCSVLine(line); // Use proper CSV parser
              return {
                id: Date.now().toString() + index,
                business_name: values[0] || '',
                category: normalizeCategory(values[1] || ''), // ✅ NORMALIZE CATEGORY
                street: values[2] || '',
                coordinates: values[3] || '',
                zone_type: values[4] || '',
                status: (values[5]?.toLowerCase() === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
              };
            });
        }

        if (newBusinesses.length > 0) {
          setBusinesses(newBusinesses);
          await saveBusinesses(newBusinesses);
          await loadStats(); // Reload stats after upload
          toast.success(`Successfully uploaded ${newBusinesses.length} businesses`);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    setBusinesses([]);
    saveBusinesses([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-slate-700 shadow-xl">
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-slate-400/20 blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="absolute top-1/2 left-1/2 h-32 w-32 rounded-full bg-slate-300/30 blur-xl -translate-x-1/2 -translate-y-1/2"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Seed Data Management</h1>
                <p className="text-slate-200">Manage your K-Means clustering dataset and trigger ML training</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingBusiness(null);
                setIsAddEditModalOpen(true);
              }}
              className="group flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 border border-white/30"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Add Business
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Training Status */}
        <TrainingStatus status={trainingStatus} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard title="Total Businesses" value={totalBusinesses} icon={Building2} bgColor="bg-purple-50" />
          <StatsCard title="Categories" value={totalCategories} icon={Tag} bgColor="bg-blue-50" />
          <StatsCard title="Zone Types" value={totalZones} icon={MapPinned} bgColor="bg-green-50" />
        </div>

        {/* Dataset Actions */}
        <DatasetActions
          onRefresh={handleRefresh}
          onDownload={handleDownload}
          onUpload={handleUpload}
          onReset={handleReset}
          isLoading={isLoading}
        />

        {/* Search & Filters */}
        <SearchFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          zoneFilter={zoneFilter}
          onZoneChange={setZoneFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categories={categories}
          zones={zones}
        />

        {/* Data Table */}
        <SeedDataTable
          businesses={filteredBusinesses}
          onEdit={(business) => {
            setEditingBusiness(business);
            setIsAddEditModalOpen(true);
          }}
          onDelete={handleDeleteBusiness}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      {/* Add/Edit Modal */}
      <AddEditBusinessModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingBusiness(null);
        }}
        onSave={editingBusiness ? handleEditBusiness : handleAddBusiness}
        business={editingBusiness}
        categories={categories.length > 0 ? categories : ['Cafe', 'Retail', 'Technology', 'Fitness', 'Grocery']}
        zones={zones.length > 0 ? zones : ['Commercial', 'Residential', 'Business', 'Industrial']}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setBusinessToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Business"
        message="Are you sure you want to delete this business? This action cannot be undone and will trigger model retraining."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmReset}
        title="Reset Seed Dataset"
        message="Are you sure you want to reset the entire seed dataset? This will delete all business entries and cannot be undone."
        confirmText="Reset All Data"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
