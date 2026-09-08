const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
    requireProjectMember,
    requireProjectRole,
} = require("../middleware/projectMiddleware");

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
} = require("../controllers/projectController");

const {
    getProjectMembers,
    addProjectMember,
    updateMemberRole,
    removeProjectMember,
} = require("../controllers/projectMemberController");

const {
    inviteUser,
    getProjectInvitations,
    cancelInvitation,
    getMyInvitations,
    acceptInvitation,
    rejectInvitation,
} = require("../controllers/projectInvitationController");

// All project endpoints require valid user authentication
router.use(protect);

// ── Global User Invitations (placed before /:id routes) ─────────────────────────
router.get("/invitations/my", getMyInvitations);
router.post("/invitations/:invitationId/accept", acceptInvitation);
router.post("/invitations/:invitationId/reject", rejectInvitation);

// ── Project CRUD ──────────────────────────────────────────────────────────────
router.route("/")
    .post(createProject)
    .get(getProjects);

router.route("/:id")
    .get(requireProjectMember, getProjectById)
    .put(requireProjectMember, requireProjectRole("OWNER", "MANAGER"), updateProject)
    .delete(requireProjectMember, requireProjectRole("OWNER"), deleteProject);

// ── Member Management ─────────────────────────────────────────────────────────
router.route("/:id/members")
    .get(requireProjectMember, getProjectMembers)
    .post(requireProjectMember, requireProjectRole("OWNER", "MANAGER"), addProjectMember);

router.route("/:id/members/:userId")
    .put(requireProjectMember, requireProjectRole("OWNER", "MANAGER"), updateMemberRole)
    .delete(requireProjectMember, removeProjectMember);

// ── Project Invitations Management ────────────────────────────────────────────
router.route("/:id/invitations")
    .get(requireProjectMember, requireProjectRole("OWNER", "MANAGER"), getProjectInvitations)
    .post(requireProjectMember, requireProjectRole("OWNER", "MANAGER"), inviteUser);

router.delete(
    "/:id/invitations/:invitationId",
    requireProjectMember,
    requireProjectRole("OWNER", "MANAGER"),
    cancelInvitation
);

module.exports = router;
