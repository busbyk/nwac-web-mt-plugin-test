import type { CollectionConfig } from 'payload'
import { accessByTenant } from '@/access/byTenant'
import { filterByTenant } from '@/access/filterByTenant'

// A role assignment binds a user to a set of roles in a tenant.
export const RoleAssignments: CollectionConfig = {
  slug: 'roleAssignments',
  access: accessByTenant('roleAssignments'),
  admin: {
    baseListFilter: filterByTenant,
    group: 'Permissions',
  },
  fields: [
    {
      name: 'roles',
      type: 'relationship',
      index: true,
      relationTo: 'roles',
      hasMany: true,
      saveToJWT: true,
    },
    {
      name: 'user',
      type: 'relationship',
      index: true,
      relationTo: 'users',
      saveToJWT: true,
    },
  ],
}
