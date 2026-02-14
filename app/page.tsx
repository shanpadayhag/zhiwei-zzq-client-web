"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2, MapPin, BriefcaseBusinessIcon, Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Dexie from 'dexie';

// Types
type ApplicationStatus = "Applied" | "Interviewing" | "Offer" | "Rejected" | "Withdrawn";
type CoolOffStartType = "application" | "rejection";

interface JobApplication {
  id?: number;
  company: string;
  jobTitle: string;
  location: string;
  status: ApplicationStatus;
  appliedDate: string;
  coolOffEnds: string;
  coolOffStartType: CoolOffStartType;
}

// Database setup
const db = new Dexie('JobApplicationsDB') as Dexie & {
  applications: Dexie.Table<JobApplication, number>;
};

db.version(1).stores({
  applications: '++id, company, jobTitle, location, status, appliedDate, coolOffEnds, coolOffStartType'
});

export default function Home() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    interviewing: 0,
    offers: 0,
    activeCoolOffs: 0,
  });
  const [formData, setFormData] = useState({
    company: "",
    jobTitle: "",
    location: "",
    status: "Applied" as ApplicationStatus,
    coolOffStartType: "application" as CoolOffStartType,
  });

  const ITEMS_PER_PAGE = 10;

  // Load applications with cursor pagination
  const loadApplications = async (page: number) => {
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;

      // Get total count
      const total = await db.applications.count();
      setTotalCount(total);

      // Get paginated data (sorted by appliedDate descending)
      const apps = await db.applications
        .orderBy('appliedDate')
        .reverse()
        .offset(offset)
        .limit(ITEMS_PER_PAGE)
        .toArray();

      setApplications(apps);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const total = await db.applications.count();
      const interviewing = await db.applications.where('status').equals('Interviewing').count();
      const offers = await db.applications.where('status').equals('Offer').count();

      // Calculate active cool-offs
      const allApps = await db.applications.toArray();
      const activeCoolOffs = allApps.filter(app => getDaysRemaining(app.coolOffEnds) > 0).length;

      setStats({
        total,
        interviewing,
        offers,
        activeCoolOffs,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    loadApplications(currentPage);
    loadStats();
  }, [currentPage]);

  const calculateCoolOffDate = (appliedDate: string, startType: CoolOffStartType) => {
    const date = new Date(appliedDate);
    date.setMonth(date.getMonth() + 6);
    return date.toISOString().split("T")[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Check for duplicate (same company, job title, and location)
      const existingApp = await db.applications
        .where('company').equalsIgnoreCase(formData.company)
        .and(app =>
          app.jobTitle.toLowerCase() === formData.jobTitle.toLowerCase() &&
          app.location.toLowerCase() === formData.location.toLowerCase() &&
          app.id !== editingId
        )
        .first();

      if (existingApp) {
        alert("This application already exists! You cannot apply to the same company, role, and location.");
        return;
      }

      const appliedDate = new Date().toISOString().split("T")[0];
      const coolOffEnds = calculateCoolOffDate(appliedDate, formData.coolOffStartType);

      if (editingId) {
        // Update existing
        await db.applications.update(editingId, {
          ...formData,
        });
      } else {
        // Create new
        const newApp: JobApplication = {
          ...formData,
          appliedDate,
          coolOffEnds,
        };
        await db.applications.add(newApp);
      }

      resetForm();

      // Reload data
      loadApplications(currentPage);
      loadStats();
    } catch (error) {
      console.error('Error saving application:', error);
      alert('Failed to save application');
    }
  };

  const resetForm = () => {
    setFormData({
      company: "",
      jobTitle: "",
      location: "",
      status: "Applied",
      coolOffStartType: "application",
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (app: JobApplication) => {
    setFormData({
      company: app.company,
      jobTitle: app.jobTitle,
      location: app.location,
      status: app.status,
      coolOffStartType: app.coolOffStartType,
    });
    setEditingId(app.id!);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this application?")) {
      try {
        await db.applications.delete(id);
        loadApplications(currentPage);
        loadStats();
      } catch (error) {
        console.error('Error deleting application:', error);
      }
    }
  };

  const handleStatusChange = async (id: number, newStatus: ApplicationStatus) => {
    try {
      const app = await db.applications.get(id);
      if (!app) return;

      let coolOffEnds = app.coolOffEnds;

      // Recalculate cool-off if status changed to Rejected and cool-off starts on rejection
      if (newStatus === "Rejected" && app.coolOffStartType === "rejection") {
        coolOffEnds = calculateCoolOffDate(new Date().toISOString().split("T")[0], "rejection");
      }

      await db.applications.update(id, { status: newStatus, coolOffEnds });
      loadApplications(currentPage);
      loadStats();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getDaysRemaining = (coolOffDate: string) => {
    const today = new Date();
    const endDate = new Date(coolOffDate);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Questrial&family=Work+Sans:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Work Sans', sans-serif;
        }

        h1, h2, h3 {
          font-family: 'Questrial', sans-serif;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.4s ease-out forwards;
          opacity: 0;
        }

        .stagger-1 { animation-delay: 0.05s; }
        .stagger-2 { animation-delay: 0.1s; }
        .stagger-3 { animation-delay: 0.15s; }

        .glass-effect {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}</style>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-slate-900 mb-2 tracking-tight">
                Application Tracker
              </h1>
              <p className="text-slate-600 text-lg">
                Manage your job applications and cool-off periods
              </p>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Applications", value: stats.total, icon: BriefcaseBusinessIcon, color: "blue" },
            { label: "Interviewing", value: stats.interviewing, icon: Clock, color: "purple" },
            { label: "Offers", value: stats.offers, icon: Calendar, color: "green" },
            { label: "Active Cool-offs", value: stats.activeCoolOffs, icon: Building2, color: "orange" },
          ].map((stat, idx) => (
            <div
              key={stat.label}
              className={`glass-effect rounded-xl p-6 shadow-sm hover:shadow-md transition-all animate-slide-up stagger-${idx + 1}`}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                <span className="text-3xl font-bold text-slate-900">{stat.value}</span>
              </div>
              <p className="text-sm text-slate-600 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="glass-effect rounded-xl shadow-lg overflow-hidden animate-slide-up stagger-3">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Company</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Job Title</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Applied Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Cool-Off Ends</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <BriefcaseBusinessIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium">No applications yet</p>
                      <p className="text-sm mt-1">Click "New Application" to get started</p>
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => {
                    const daysRemaining = getDaysRemaining(app.coolOffEnds);
                    const isCoolOffActive = daysRemaining > 0;

                    return (
                      <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="font-medium text-slate-900">{app.company}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <BriefcaseBusinessIcon className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="text-slate-700">{app.jobTitle}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="text-slate-700">{app.location}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={app.status}
                            onValueChange={(value: ApplicationStatus) => handleStatusChange(app.id!, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Applied">Applied</SelectItem>
                              <SelectItem value="Interviewing">Interviewing</SelectItem>
                              <SelectItem value="Offer">Offer</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                              <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {new Date(app.appliedDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-slate-700">
                              {new Date(app.coolOffEnds).toLocaleDateString()}
                            </div>
                            <div className={`text-xs mt-1 ${isCoolOffActive ? 'text-orange-600' : 'text-green-600'}`}>
                              {isCoolOffActive ? `${daysRemaining} days left` : 'Can reapply'}
                            </div>
                            <div className="text-xs text-slate-500">
                              Starts: {app.coolOffStartType === "application" ? "On apply" : "On reject"}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(app)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(app.id!)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white border-t border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} applications
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        return page === 1 ||
                               page === totalPages ||
                               Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        // Add ellipsis if there's a gap
                        const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1;

                        return (
                          <div key={page} className="flex items-center">
                            {showEllipsisBefore && (
                              <span className="px-2 text-slate-400">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          </div>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Application" : "New Application"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the details below" : "Add a new job application to track"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., Google"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Software Engineer"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., San Francisco, CA"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: ApplicationStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Applied">Applied</SelectItem>
                  <SelectItem value="Interviewing">Interviewing</SelectItem>
                  <SelectItem value="Offer">Offer</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="coolOffStartType">Cool-Off Period Starts</Label>
              <Select
                value={formData.coolOffStartType}
                onValueChange={(value: CoolOffStartType) => setFormData({ ...formData, coolOffStartType: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">After Application</SelectItem>
                  <SelectItem value="rejection">After Rejection</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                6 months from the selected event
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? "Update" : "Add"} Application
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
