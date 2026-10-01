import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

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
  useDocumentTitle("Subjects");
  const { identity } = useAuth();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const isOwner = role === "OWNER";
  const { data: courses, loading, error, reload } = useApiData(() => api.get<CourseRow[]>("/api/courses"));

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle={
          role === "TEACHER" ? (
            "The subjects you teach."
          ) : (
            <>
              Every subject taught across your organization.{" "}
              {isOwner && (
                <>
                  Add one from <Link to="/dashboard/structure">the group that studies it</Link>.
                </>
              )}
            </>
          )
        }
        actions={
          isOwner && (
            <Link to="/dashboard/structure" className="btn btn-secondary">
              Open structure
            </Link>
          )
        }
      />

      <AsyncState loading={loading} error={error} data={courses} onRetry={reload}>
        {(courses) =>
          courses.length === 0 ? (
            <EmptyState
              title={
                role === "TEACHER"
                  ? "You haven't been assigned any subjects yet. Ask the owner to assign you to one."
                  : "No subjects yet. Open a group and add the subjects it studies."
              }
              action={
                isOwner && (
                  <Link to="/dashboard/structure" className="btn btn-primary">
                    Go to structure
                  </Link>
                )
              }
            />
          ) : (
            <DataTable
              caption="Subjects"
              rows={courses}
              rowKey={(c) => c.id}
              columns={[
                {
                  header: "Subject",
                  primary: true,
                  sortValue: (c) => c.name,
                  render: (c) => <Link to={`/dashboard/courses/${c.id}`}>{c.name}</Link>,
                },
                {
                  header: "Group",
                  sortValue: (c) => c.orgUnit.name,
                  render: (c) => <Link to={`/dashboard/structure/${c.orgUnit.id}`}>{c.orgUnit.name}</Link>,
                },
                {
                  header: "Teacher",
                  sortValue: (c) => c.teacher?.name ?? "",
                  render: (c) => c.teacher?.name ?? <span className="tag tag-warning">Unassigned</span>,
                },
                {
                  header: "Taken by",
                  render: (c) =>
                    c.enrollmentMode === "SELECTED"
                      ? `${c._count.courseEnrollments} selected student${c._count.courseEnrollments === 1 ? "" : "s"}`
                      : "Everyone in the group",
                },
              ]}
            />
          )
        }
      </AsyncState>
    </div>
  );
}
