import { Access, CollectionConfig } from 'payload'
import { byGlobalRole } from '@/access/byGlobalRole'
import { roleAssignmentsForUser } from '@/utilities/rbac/roleAssignmentsForUser'
import { ruleMatches, ruleMethod } from '@/utilities/rbac/ruleMatches'

// byGlobalRoleOrTenantIds supplants global access review with tenant-scoped tenant grants, allowing tenant
// scoped role assignments for tenant access to apply for the tenant identified in the role assignment
export const byGlobalRoleOrTenantIds: (method: ruleMethod) => Access =
  (method: ruleMethod): Access =>
  (args) => {
    if (!args.req.user) {
      return false
    }

    const globalAccess = byGlobalRole(method, 'tenants')(args)
    if (typeof globalAccess === 'boolean' ? globalAccess : true) {
      // if globalAccess returned anything but 'false', pass it along
      return globalAccess
    }

    const roleAssignments = roleAssignmentsForUser(args.req.payload.logger, args.req.user)
    const matchingTenantIds = roleAssignments
      .filter(
        (assignment) =>
          assignment.roles &&
          assignment.roles
            .filter((role) => typeof role !== 'number') // captured in the getter
            .map((role) => role.rules)
            .flat()
            .some(ruleMatches(method, 'tenants')),
      )
      .map((assignment) => assignment.tenant)
      .filter((tenant) => typeof tenant !== 'number') // captured in the getter
      .map((tenant) => tenant.id)

    if (matchingTenantIds.length > 0) {
      return {
        id: {
          in: matchingTenantIds,
        },
      }
    }

    return false
  }

export const accessByGlobalRoleOrTenantIds: CollectionConfig['access'] = {
  create: byGlobalRoleOrTenantIds('create'),
  read: byGlobalRoleOrTenantIds('read'),
  update: byGlobalRoleOrTenantIds('update'),
  delete: byGlobalRoleOrTenantIds('delete'),
}
