export type Pet = NewPet & { id: number }
export type NewPet = {
  name: string
  tag?: string
}
export type Error = {
  code: number
  message: string
}
export type FindPetsParams = {
  tags?: string[]
  limit?: number
  'X-Froggo': string
  'X-Request-ID'?: number
  'X-Request-ID-2'?: boolean
}
export type FindPetByIdParams = {
  id: number
}
export type DeletePetParams = {
  id: number
}
export type __HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE'
export type __HttpHeaders = { [key: string]: string }
export type __HttpBody = string | null
export type __HttpRequest = {
  url: string
  method: __HttpMethod
  body?: __HttpBody
  headers: __HttpHeaders
}
export type __HttpResponse = {
  status: number
  header: __HttpHeaders
  body?: __HttpBody
}
export type __HttpAdapter = {
  execute(request: __HttpRequest): Promise<__HttpResponse>
}
export type PetStoreApi = {
  findPets(params: FindPetsParams): Promise<Pet[] | Error>
  addPet(content: NewPet): Promise<Pet | Error>
  findPetById(params: FindPetByIdParams): Promise<Pet | Error>
  deletePet(params: DeletePetParams): Promise<void | Error>
}
export class PetStoreApiImpl implements PetStoreApi {
  private readonly adapter: __HttpAdapter
  constructor(adapter: __HttpAdapter) {
    this.adapter = adapter
  }
  findPets(params: FindPetsParams): Promise<Pet[] | Error> {
    const request: __HttpRequest = {
      url: (() => {
        const querySegments = [
          params.tags === undefined || params.tags.length === 0 ? null : params.tags.map((e) => `tags=${e}`).join('&'),
          params.limit === undefined ? null : `limit=${params.limit}`,
        ]
        const queryString = querySegments.filter((segment) => segment !== null).join('&')
        const query = queryString.length === 0 ? '' : `?${queryString}`
        return `/pets${query}`
      })(),
      method: 'GET',
      headers: {
        'X-Froggo': String(params['X-Froggo']),
        ...(params['X-Request-ID'] === undefined ? {} : { 'X-Request-ID': String(params['X-Request-ID']) }),
        ...(params['X-Request-ID-2'] === undefined ? {} : { 'X-Request-ID-2': String(params['X-Request-ID-2']) }),
      },
    }
    return this.adapter.execute(request).then(
      ({ body, status }: __HttpResponse): Promise<Pet[] | Error> => {
        switch (status) {
          case 200:
            return Promise.resolve(JSON.parse(body) as Pet[])
          default:
            return status >= 200 && status < 300
              ? Promise.resolve(JSON.parse(body) as Error)
              : Promise.reject(JSON.parse(body) as Error)
        }
      }
    )
  }
  addPet(content: NewPet): Promise<Pet | Error> {
    const request: __HttpRequest = {
      url: '/pets',
      method: 'POST',
      headers: {},
      body: JSON.stringify(content),
    }
    return this.adapter.execute(request).then(
      ({ body, status }: __HttpResponse): Promise<Pet | Error> => {
        switch (status) {
          case 200:
            return Promise.resolve(JSON.parse(body) as Pet)
          default:
            return status >= 200 && status < 300
              ? Promise.resolve(JSON.parse(body) as Error)
              : Promise.reject(JSON.parse(body) as Error)
        }
      }
    )
  }
  findPetById(params: FindPetByIdParams): Promise<Pet | Error> {
    const request: __HttpRequest = {
      url: `/pets/${params.id}`,
      method: 'GET',
      headers: {},
    }
    return this.adapter.execute(request).then(
      ({ body, status }: __HttpResponse): Promise<Pet | Error> => {
        switch (status) {
          case 200:
            return Promise.resolve(JSON.parse(body) as Pet)
          default:
            return status >= 200 && status < 300
              ? Promise.resolve(JSON.parse(body) as Error)
              : Promise.reject(JSON.parse(body) as Error)
        }
      }
    )
  }
  deletePet(params: DeletePetParams): Promise<void | Error> {
    const request: __HttpRequest = {
      url: `/pets/${params.id}`,
      method: 'DELETE',
      headers: {},
    }
    return this.adapter.execute(request).then(
      ({ body, status }: __HttpResponse): Promise<void | Error> => {
        switch (status) {
          case 204:
            return Promise.resolve()
          default:
            return status >= 200 && status < 300
              ? Promise.resolve(JSON.parse(body) as Error)
              : Promise.reject(JSON.parse(body) as Error)
        }
      }
    )
  }
}
