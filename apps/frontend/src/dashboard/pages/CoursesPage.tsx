import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";

interface CourseRow {
  id: string;
  name: string;
  code: string | null;
  enrollmentMode: "ALL_IN_UNIT" | "SELECTED";
  teacher: { id: string; name: string } | null;
  orgUnit: { id: string; name: string };
  _count: { courseEnrollments: number };
}

export function CoursesPage() {
  const { data: courses, loading, error, reload } = useApiData(() => api.get<CourseRow[]>("/api/courses"));

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Subjects</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 24 }}>
        Every subject taught across your organization. Add one from the group that studies it.
      </p>

      <AsyncState loading={loading} error={error} data={courses} onRetry={reload}>
        {(courses) => (
          <DataTable
            rows={courses}
            rowKey={(c) => c.id}
            emptyMessage="No subjects yet — open a group under Structure and add one."
            columns={[
              { header: "Subject", render: (c) => <Link to={`/dashboard/courses/${c.id}`}>{c.name}</Link> },
              {
                header: "Group",
                render: (c) => <Link to={`/dashboard/structure/${c.orgUnit.id}`}>{c.orgUnit.name}</Link>,
              },
              { header: "Teacher", render: (c) => c.teacher?.name ?? "—" },
              {
                header: "Taken by",
                render: (c) =>
                  c.enrollmentMode === "SELECTED"
                    ? `${c._count.courseEnrollments} selected student${c._count.courseEnrollments === 1 ? "" : "s"}`
                    : "Everyone in the group",
              },
            ]}
          />
        )}
      </AsyncState>
    </div>
  );
}
