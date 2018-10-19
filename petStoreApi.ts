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
}
export type FindPetByIdParams = {
  id: number
}
export type DeletePetParams = {
  id: number
}
export type Api = {
  findPets(params: FindPetsParams): Promise<Pet[] | Error>
  addPet(content: NewPet): Promise<Pet | Error>
  findPetById(params: FindPetByIdParams): Promise<Pet | Error>
  deletePet(params: DeletePetParams): Promise<void | Error>
}
export type __Request = {
  url: string
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE'
  body: string
  headers: { [key: string]: string }
}
export type __Response = {
  status: number
  body: string
}
export abstract class BaseApiImpl implements Api {
  abstract execute(request: __Request): Promise<__Response>
  abstract getBaseUrl(): string
  abstract getDefaultHeaders(): { [key: string]: string }
  findPets(params: FindPetsParams): Promise<Pet[] | Error> {
    const request: __Request = {
      url: `${this.getBaseUrl()}/pets`,
      method: 'GET',
      headers: this.getDefaultHeaders(),
      body: undefined,
    }
    return this.execute(request).then(
      ({ body, status }: __Response): Promise<Pet[] | Error> => {
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
    const request: __Request = {
      url: `${this.getBaseUrl()}/pets`,
      method: 'POST',
      headers: this.getDefaultHeaders(),
      body: JSON.stringify(content),
    }
    return this.execute(request).then(
      ({ body, status }: __Response): Promise<Pet | Error> => {
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
    const request: __Request = {
      url: `${this.getBaseUrl()}/pets/${params.id}`,
      method: 'GET',
      headers: this.getDefaultHeaders(),
      body: undefined,
    }
    return this.execute(request).then(
      ({ body, status }: __Response): Promise<Pet | Error> => {
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
    const request: __Request = {
      url: `${this.getBaseUrl()}/pets/${params.id}`,
      method: 'DELETE',
      headers: this.getDefaultHeaders(),
      body: undefined,
    }
    return this.execute(request).then(
      ({ body, status }: __Response): Promise<void | Error> => {
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
