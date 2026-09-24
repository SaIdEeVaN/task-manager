"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string; // "todo", "in_progress", "done"
  createdAt: string;
  updatedAt: string;
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  
  // Theme and Task states
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (document.documentElement.getAttribute("data-theme") || "light") as "light" | "dark";
    }
    return "light";
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditTask, setCurrentEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize tasks on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Task creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });

      if (res.ok) {
        const newTask = await res.json();
        setTasks((prev) => [newTask, ...prev]);
        setNewTitle("");
        setNewDescription("");
        setIsAddModalOpen(false);
      }
    } catch (err) {
      console.error("Error creating task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open task editor modal
  const openEditModal = (task: Task) => {
    setCurrentEditTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setIsEditModalOpen(true);
  };

  // Edit task submission
  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEditTask || !editTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${currentEditTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setIsEditModalOpen(false);
        setCurrentEditTask(null);
      }
    } catch (err) {
      console.error("Error editing task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error();
      }
    } catch (err) {
      console.error("Error deleting task:", err);
      // Revert if error
      setTasks(previousTasks);
    }
  };

  // Update task status (directly, e.g. for drag/drop or mobile selectors)
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error();
      }
    } catch (err) {
      console.error("Error updating status:", err);
      // Revert if error
      setTasks(previousTasks);
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault();
    setDragOverColumn(columnStatus);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    // Only update if status changed
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== columnStatus) {
      await updateTaskStatus(taskId, columnStatus);
    }
  };

  // Filter tasks based on search
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description &&
        task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Calculate statistics
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className={styles.dashboard}>
      {/* Header bar */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoContainer}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className={styles.logoText}>TASKIFY</span>
          </div>

          <div className={styles.userMenu}>
            <div className={styles.userInfo}>
              Hi, {user.name || user.email.split("@")[0]}
            </div>
            <div className={styles.avatar}>
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            
            {/* Theme switcher button */}
            <button
              onClick={toggleTheme}
              className={styles.iconButton}
              aria-label="Toggle Theme"
              title="Toggle Light/Dark Mode"
            >
              {theme === "light" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </button>

            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className={styles.main}>
        {/* Stats grid */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Tasks</span>
            <span className={styles.statVal}>{tasks.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel} style={{ color: "#0ea5e9" }}>To Do</span>
            <span className={styles.statVal}>{todoCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel} style={{ color: "#f97316" }}>In Progress</span>
            <span className={styles.statVal}>{inProgressCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel} style={{ color: "#10b981" }}>Completed</span>
            <span className={styles.statVal}>{doneCount}</span>
          </div>
        </section>

        {/* Toolbar */}
        <section className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className={styles.actionBtn}
          >
            Create Task
          </button>
        </section>

        {/* Loading state indicator */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            Loading board...
          </div>
        ) : (
          /* Kanban Board */
          <section className={styles.board}>
            {/* TODO Column */}
            <div
              className={`${styles.column} ${
                dragOverColumn === "todo" ? styles.columnDraggingOver : ""
              }`}
              onDragOver={(e) => handleDragOver(e, "todo")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "todo")}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnTitle}>
                  <span className={`${styles.columnDot} ${styles.dotTodo}`} />
                  <span>To Do</span>
                </div>
                <span className={styles.columnBadge}>{todoCount}</span>
              </div>
              <div className={styles.cardList}>
                {filteredTasks
                  .filter((t) => t.status === "todo")
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEditClick={openEditModal}
                      onDeleteClick={handleDeleteTask}
                      onStatusChange={updateTaskStatus}
                      onDragStart={handleDragStart}
                    />
                  ))}
              </div>
            </div>

            {/* IN PROGRESS Column */}
            <div
              className={`${styles.column} ${
                dragOverColumn === "in_progress" ? styles.columnDraggingOver : ""
              }`}
              onDragOver={(e) => handleDragOver(e, "in_progress")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "in_progress")}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnTitle}>
                  <span className={`${styles.columnDot} ${styles.dotProgress}`} />
                  <span>In Progress</span>
                </div>
                <span className={styles.columnBadge}>{inProgressCount}</span>
              </div>
              <div className={styles.cardList}>
                {filteredTasks
                  .filter((t) => t.status === "in_progress")
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEditClick={openEditModal}
                      onDeleteClick={handleDeleteTask}
                      onStatusChange={updateTaskStatus}
                      onDragStart={handleDragStart}
                    />
                  ))}
              </div>
            </div>

            {/* DONE Column */}
            <div
              className={`${styles.column} ${
                dragOverColumn === "done" ? styles.columnDraggingOver : ""
              }`}
              onDragOver={(e) => handleDragOver(e, "done")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "done")}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnTitle}>
                  <span className={`${styles.columnDot} ${styles.dotDone}`} />
                  <span>Done</span>
                </div>
                <span className={styles.columnBadge}>{doneCount}</span>
              </div>
              <div className={styles.cardList}>
                {filteredTasks
                  .filter((t) => t.status === "done")
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEditClick={openEditModal}
                      onDeleteClick={handleDeleteTask}
                      onStatusChange={updateTaskStatus}
                      onDragStart={handleDragStart}
                    />
                  ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* CREATE TASK MODAL */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Task</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className={styles.iconButton}
                style={{ border: "none", width: "24px", height: "24px" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTask} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="taskTitle">
                  Title
                </label>
                <input
                  className={styles.input}
                  type="text"
                  id="taskTitle"
                  placeholder="Task title..."
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="taskDesc">
                  Description
                </label>
                <textarea
                  className={styles.input}
                  id="taskDesc"
                  placeholder="Write a brief description..."
                  rows={4}
                  style={{ resize: "none" }}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={styles.secondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.actionBtn}
                >
                  {isSubmitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit Task</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={styles.iconButton}
                style={{ border: "none", width: "24px", height: "24px" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditTask} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="editTaskTitle">
                  Title
                </label>
                <input
                  className={styles.input}
                  type="text"
                  id="editTaskTitle"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="editTaskDesc">
                  Description
                </label>
                <textarea
                  className={styles.input}
                  id="editTaskDesc"
                  rows={4}
                  style={{ resize: "none" }}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={styles.secondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.actionBtn}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent to render individual task cards with HTML5 drag events
interface TaskCardProps {
  task: Task;
  onEditClick: (task: Task) => void;
  onDeleteClick: (id: string) => void;
  onStatusChange: (id: string, newStatus: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

function TaskCard({
  task,
  onEditClick,
  onDeleteClick,
  onStatusChange,
  onDragStart,
}: TaskCardProps) {
  const formattedDate = new Date(task.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={styles.taskCard}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
    >
      <div className={styles.taskTitle}>{task.title}</div>
      {task.description && (
        <div className={styles.taskDesc}>{task.description}</div>
      )}
      
      <div className={styles.taskFooter}>
        <span>{formattedDate}</span>
        
        {/* Status switcher visible only on mobile viewports for responsive controls */}
        <select
          className={styles.statusSelector}
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className={styles.taskActions}>
          <button
            onClick={() => onEditClick(task)}
            className={styles.taskBtn}
            title="Edit Task"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            onClick={() => onDeleteClick(task.id)}
            className={`${styles.taskBtn} ${styles.deleteBtn}`}
            title="Delete Task"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
