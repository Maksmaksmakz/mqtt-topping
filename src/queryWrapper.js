import axios from "axios"
import get from "lodash.get"
import omit from "lodash.omit"

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = `${uri}/query`
  }

  send(query) {
    if (Array.isArray(query)) {
      return this.sendBatch(query)
    } else {
      return this.sendSingle(query)
    }
  }

  sendJson(query) {
    const jsonQuery = Object.assign({}, query, { depth: -1, parseJson: false })

    return this.sendSingle(jsonQuery)
      .then(makeObject)
      .catch(() => ({}))
  }

  sendBatch(queries) {
    return axios.post(this.queryUri, queries.map(omitParseJson)).then(({ data }) =>
      data.map((result, index) => {
        const query = queries[index]

        if (shouldParseJson(query)) {
          try {
            parsePayloads(result)
          } catch (error) {
            return {
              topic: query.topic,
              error
            }
          }
        }

        return result
      })
    )
  }

  sendSingle(query) {
    return axios.post(this.queryUri, omitParseJson(query)).then(({ data }) => {
      if (shouldParseJson(query)) {
        parsePayloads(data)
      }

      return data
    }).catch(({ data }) => {
      throw data
    })
  }
}

function makeObject(result, isRoot = true) {
  if (result.children) {
    const object = {}

    result.children.forEach((child) => {
      const key = child.topic.split("/").pop()

      try {
        object[key] = makeObject(child, false)
      } catch (e) {
        // ignore children that contain invalid JSON
      }
    })

    return object
  } else if (!isRoot) {
    return JSON.parse(result.payload)
  } else {
    return {}
  }
}

function omitParseJson(query) {
  return omit(query, "parseJson")
}

function shouldParseJson(query) {
  return get(query, "parseJson", true)
}

function parsePayloads(result) {
  if (Array.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result) {
  if (result.payload) {
    result.payload = JSON.parse(result.payload)
  }

  if (result.children) {
    result.children.map(parsePayloads)
  }
}
