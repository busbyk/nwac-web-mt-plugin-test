import type {
  CollectionSlug,
  GlobalSlug,
  Payload,
  PayloadRequest,
  File,
  RequiredDataFromCollectionSlug,
  User,
} from 'payload'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { imageHero1 } from './image-hero-1'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { Role, Tenant } from '@/payload-types'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'search',
  'roles',
  'roleAssignments',
  'globalRoleAssignments',
  'tenants',
]
const globals: GlobalSlug[] = ['header', 'footer']

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // we need to clear the media directory before seeding
  // as well as the collections and globals
  // this is because while `yarn seed` drops the database
  // the custom `/api/seed` endpoint does not
  payload.logger.info(`— Clearing collections and globals...`)

  // clear the database
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  payload.logger.info(`— Seeding roles...`)

  const roleData: RequiredDataFromCollectionSlug<'roles'>[] = [
    {
      name: 'Admin',
      rules: [
        {
          collections: ['*'],
          actions: ['*'],
        },
      ],
    },
    {
      name: 'User Administrator',
      rules: [
        {
          collections: ['roleAssignments'],
          actions: ['create', 'update'],
        },
      ],
    },
    {
      name: 'Contributor',
      rules: [
        {
          collections: ['posts', 'pages', 'categories', 'media'],
          actions: ['create', 'update'],
        },
      ],
    },
    {
      name: 'Viewer',
      rules: [
        {
          collections: ['*'],
          actions: ['read'],
        },
      ],
    },
  ]
  const roles: Record<string, Role> = {}
  for (const data of roleData) {
    payload.logger.info(`Creating ${data.name} role...`)
    const role = await payload
      .create({
        collection: 'roles',
        data: data,
      })
      .catch((e) => payload.logger.error(e))

    if (!role) {
      payload.logger.error(`Creating ${data.name} role returned null...`)
      return
    }
    roles[data.name] = role
  }

  payload.logger.info(`— Seeding tenants...`)

  const tenantData: RequiredDataFromCollectionSlug<'tenants'>[] = [
    {
      name: 'Northwest Avalanche Center',
      slug: 'nwac',
      domains: [{ domain: 'nwac.us' }],
    },
    {
      name: 'Sierra Avalanche Center',
      slug: 'sac',
      domains: [{ domain: 'sierraavalanchecenter.org' }],
    },
  ]
  const tenants: Record<string, Tenant> = {}
  for (const data of tenantData) {
    payload.logger.info(`Creating ${data.name} tenant returned...`)
    const tenant = await payload
      .create({
        collection: 'tenants',
        data: data,
      })
      .catch((e) => payload.logger.error(e))

    if (!tenant) {
      payload.logger.error(`Creating ${data.name} tenant returned null...`)
      return
    }
    tenants[data.slug] = tenant
  }
  payload.logger.info(`— Seeding users...`)

  const userData: RequiredDataFromCollectionSlug<'users'>[] = [
    {
      name: 'Super Admin',
      email: 'admin@avy.com',
      password: 'password',
    },
    ...Object.values(tenants)
      .map((tenant): RequiredDataFromCollectionSlug<'users'>[] => [
        {
          name: tenant.slug.toUpperCase() + ' Admin',
          email: 'admin@' + (tenant.domains as NonNullable<Tenant['domains']>)[0].domain,
          password: 'password',
        },
        {
          name: tenant.slug.toUpperCase() + ' Contributor',
          email: 'contributor@' + (tenant.domains as NonNullable<Tenant['domains']>)[0].domain,
          password: 'password',
        },
        {
          name: tenant.slug.toUpperCase() + ' Viewer',
          email: 'viewer@' + (tenant.domains as NonNullable<Tenant['domains']>)[0].domain,
          password: 'password',
        },
      ])
      .flat(),
  ]
  const users: Record<string, User> = {}
  for (const data of userData) {
    payload.logger.info(`Creating ${data.name} user...`)
    const user = await payload
      .create({
        collection: 'users',
        data: data,
      })
      .catch((e) => payload.logger.error(e))

    if (!user) {
      payload.logger.error(`Creating ${data.name} user returned null...`)
      return
    }
    users[data.name] = user
  }

  payload.logger.info(`— Seeding global role assignments...`)

  const _superAdminRoleAssignment = await payload
    .create({
      collection: 'globalRoleAssignments',
      data: {
        roles: [roles['Admin']],
        user: users['Super Admin'],
      },
    })
    .catch((e) => payload.logger.error(e))

  payload.logger.info(`— Seeding tenant role assignments...`)

  const roleAssignmentData: RequiredDataFromCollectionSlug<'roleAssignments'>[] = [
    ...Object.values(tenants)
      .map((tenant): RequiredDataFromCollectionSlug<'roleAssignments'>[] => [
        {
          tenant: tenant,
          roles: [roles['Admin']],
          user: users[tenant.slug.toUpperCase() + ' Admin'],
        },
        {
          tenant: tenant,
          roles: [roles['Contributor']],
          user: users[tenant.slug.toUpperCase() + ' Contributor'],
        },

        {
          tenant: tenant,
          roles: [roles['Viewer']],
          user: users[tenant.slug.toUpperCase() + ' Viewer'],
        },
      ])
      .flat(),
  ]
  for (const data of roleAssignmentData) {
    payload.logger.info(
      `Assigning ${(data.user as User).name} role ${(data.roles as Role[])[0].name} in ${(data.tenant as Tenant).name}...`,
    )
    const roleAssignment = await payload
      .create({
        collection: 'roleAssignments',
        data: data,
      })
      .catch((e) => payload.logger.error(e))

    if (!roleAssignment) {
      payload.logger.error(
        `Assigning ${(data.user as User).name} role ${(data.roles as Role[])[0].name} in ${(data.tenant as Tenant).name} returned null...`,
      )
      return
    }
  }

  payload.logger.info(`— Seeding media...`)

  const [image1Buffer, image2Buffer, image3Buffer, hero1Buffer] = await Promise.all([
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
    ),
  ])

  const [demoAuthor, image1Doc, image2Doc, image3Doc, imageHomeDoc] = await Promise.all([
    payload.create({
      collection: 'users',
      data: {
        name: 'Demo Author',
        email: 'demo-author@example.com',
        password: 'password',
      },
    }),
    payload.create({
      collection: 'media',
      data: image1,
      file: image1Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image2Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image3Buffer,
    }),
    payload.create({
      collection: 'media',
      data: imageHero1,
      file: hero1Buffer,
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Technology',
        breadcrumbs: [
          {
            label: 'Technology',
            url: '/technology',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'News',
        breadcrumbs: [
          {
            label: 'News',
            url: '/news',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Finance',
        breadcrumbs: [
          {
            label: 'Finance',
            url: '/finance',
          },
        ],
      },
    }),
    payload.create({
      collection: 'categories',
      data: {
        title: 'Design',
        breadcrumbs: [
          {
            label: 'Design',
            url: '/design',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Software',
        breadcrumbs: [
          {
            label: 'Software',
            url: '/software',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Engineering',
        breadcrumbs: [
          {
            label: 'Engineering',
            url: '/engineering',
          },
        ],
      },
    }),
  ])

  payload.logger.info(`— Seeding posts...`)

  // Do not create posts with `Promise.all` because we want the posts to be created in order
  // This way we can sort them by `createdAt` or `publishedAt` and they will be in the expected order
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post1({ heroImage: image1Doc, blockImage: image2Doc, author: demoAuthor }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post2({ heroImage: image2Doc, blockImage: image3Doc, author: demoAuthor }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post3({ heroImage: image3Doc, blockImage: image1Doc, author: demoAuthor }),
  })

  // update each post with related posts
  await payload.update({
    id: post1Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post2Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post2Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post3Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post2Doc.id],
    },
  })

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding pages...`)

  const [_, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: home({ heroImage: imageHomeDoc, metaImage: image2Doc }),
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: contactPageData({ contactForm: contactForm }),
    }),
  ])

  payload.logger.info(`— Seeding globals...`)

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Posts',
              url: '/posts',
            },
          },
          {
            link: {
              type: 'reference',
              label: 'Contact',
              reference: {
                relationTo: 'pages',
                value: contactPage.id,
              },
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Admin',
              url: '/admin',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Source Code',
              newTab: true,
              url: 'https://github.com/payloadcms/payload/tree/main/templates/website',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Payload',
              newTab: true,
              url: 'https://payloadcms.com/',
            },
          },
        ],
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
