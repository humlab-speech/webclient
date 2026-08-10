# Admin Panel — WebSocket API Specification

This document describes the WebSocket commands that need to be implemented in the backend to support the Admin Panel feature. All commands follow the existing pattern: the client sends a JSON object over WebSocket and expects a response matching on `requestId`.

---

## General message shape

**Request (client → server):**
```json
{
  "cmd": "<commandName>",
  "requestId": "<nanoid string>"
}
```

**Response (server → client):**
```json
{
  "cmd": "<commandName>",
  "requestId": "<matching requestId>",
  "result": true,
  "data": { ... },
  "message": ""
}
```

On failure, `result` should be `false` and `message` should contain a human-readable error string.

---

## Authorization requirement

All admin commands **must** verify that the requesting user's system role is `sys_admin` (`users.system_role`, checked via `ApiServer.isSysAdminUser()`). If not, respond with:
```json
{
  "result": false,
  "message": "Unauthorized"
}
```

---

## Commands

### `adminFetchAllProjects`

Returns all projects in the system, each with their full member list and roles.

**Request:**
```json
{
  "cmd": "adminFetchAllProjects",
  "requestId": "abc123"
}
```

**Response:**
```json
{
  "cmd": "adminFetchAllProjects",
  "requestId": "abc123",
  "result": true,
  "data": {
    "projects": [
      {
        "id": 42,
        "name": "My Research Project",
        "archived": false,
        "created_at": "2024-03-15T10:30:00Z",
        "members": [
          {
            "username": "anna.svensson",
            "fullName": "Anna Svensson",
            "email": "anna.svensson@umu.se",
            "role": "project_admin"
          },
          {
            "username": "erik.lindgren",
            "fullName": "Erik Lindgren",
            "email": "erik.lindgren@umu.se",
            "role": "researcher"
          }
        ]
      }
    ]
  }
}
```

**Field notes:**
- `id` — internal project identifier (integer or string, whatever the backend uses)
- `name` — human-readable project name
- `archived` — boolean; archived projects are shown with a grey badge in the UI
- `created_at` — ISO 8601 timestamp string (used for display, so any parseable date string is fine)
- `members[].username` — the slugified eppn stored in the session / MongoDB `members` array
- `members[].fullName` — display name; the UI falls back to `username` if this is absent
- `members[].email` — email address of the member
- `members[].role` — the member's project role: `"project_admin"` or `"researcher"` (see `project_roles`). Members stored before project roles existed have no `role` and are treated as `"researcher"`.

**Implementation hint:** This is equivalent to a privileged version of `fetchProjects` with no user filter applied — query the MongoDB `projects` collection without restricting to `$_SESSION['username']`, and for each project include the full `members` sub-document array.

---

### `adminSetProjectArchived`

Sets a project's archive flag from the Admin Panel.

**Request:**
```json
{
  "cmd": "adminSetProjectArchived",
  "requestId": "abc124",
  "data": {
    "projectId": 42,
    "archived": true
  }
}
```

**Response:**
```json
{
  "cmd": "adminSetProjectArchived",
  "requestId": "abc124",
  "result": true,
  "data": {
    "projectId": 42,
    "archived": true
  }
}
```

---

### `adminDeleteProject`

Deletes a project as sysadmin.

**Request:**
```json
{
  "cmd": "adminDeleteProject",
  "requestId": "abc125",
  "data": {
    "projectId": 42
  }
}
```

**Response:**
```json
{
  "cmd": "adminDeleteProject",
  "requestId": "abc125",
  "result": true,
  "data": {
    "projectId": 42,
    "deleted": true
  }
}
```

---

### `adminSearchUsers`

Searches users to add as project members.

**Request:**
```json
{
  "cmd": "adminSearchUsers",
  "requestId": "abc126",
  "data": {
    "searchValue": "anna",
    "limit": 10
  }
}
```

**Response:**
```json
{
  "cmd": "adminSearchUsers",
  "requestId": "abc126",
  "result": true,
  "data": {
    "users": [
      {
        "username": "anna.svensson",
        "fullName": "Anna Svensson",
        "email": "anna.svensson@umu.se",
        "eppn": "anna.svensson@umu.se"
      }
    ]
  }
}
```

---

### `adminAddProjectMember`

Adds a user to a project member list, with a project role.

**Request:**
```json
{
  "cmd": "adminAddProjectMember",
  "requestId": "abc127",
  "data": {
    "projectId": 42,
    "username": "anna.svensson",
    "role": "researcher"
  }
}
```

`role` is optional and defaults to `"researcher"`. It must be a defined project
role (`project_admin` or `researcher`).

**Response:**
```json
{
  "cmd": "adminAddProjectMember",
  "requestId": "abc127",
  "result": true,
  "data": {
    "projectId": 42,
    "member": {
      "username": "anna.svensson",
      "fullName": "Anna Svensson",
      "email": "anna.svensson@umu.se",
      "eppn": "anna.svensson@umu.se",
      "role": "researcher"
    }
  }
}
```

---

### `adminRemoveProjectMember`

Removes a user from a project member list.

**Request:**
```json
{
  "cmd": "adminRemoveProjectMember",
  "requestId": "abc128",
  "data": {
    "projectId": 42,
    "username": "erik.lindgren"
  }
}
```

**Response:**
```json
{
  "cmd": "adminRemoveProjectMember",
  "requestId": "abc128",
  "result": true,
  "data": {
    "projectId": 42,
    "username": "erik.lindgren",
    "removed": true
  }
}
```

---

### `adminUpdateProjectMemberRole`

Changes a member role within a project.

**Request:**
```json
{
  "cmd": "adminUpdateProjectMemberRole",
  "requestId": "abc129",
  "data": {
    "projectId": 42,
    "username": "anna.svensson",
    "role": "project_admin"
  }
}
```

**Response:**
```json
{
  "cmd": "adminUpdateProjectMemberRole",
  "requestId": "abc129",
  "result": true,
  "data": {
    "projectId": 42,
    "username": "anna.svensson",
    "role": "project_admin"
  }
}
```

---

## Backend validation rules (recommended)

- Reject any non-`sysAdmin` caller.
- Reject unknown `projectId` and unknown `username`.
- Reject any role that is not a defined project role (`project_admin`, `researcher`).
- The admin commands deliberately do **not** refuse to leave a project with zero
  ProjectAdmins. SysAdmins hold every project permission in every project without
  being members, so an admin-less project is still administrable, and this panel is
  the tool for repairing one. (The project-scoped equivalents used by the regular
  Members dialog — `removeProjectMember` and `setProjectMemberRole` — *do* enforce
  that guard, since a project admin could otherwise strand their own project.)
- Make add/remove idempotent where possible:
  - add existing member can return success with `"added": false` (or clear error message).
  - remove missing member can return success with `"removed": false` (or clear error message).
