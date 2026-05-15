# scraper/graphql_payloads.py
"""
Contains GraphQL query strings and payload templates for UpworkScraper.
"""

# Job details GraphQL query (long fragment)
JOB_DETAILS_QUERY = """
    query GetVisitorJobDetails($id: String!, $isLoggedIn: Boolean) {
      jobPubDetails(jobId: $id, isLoggedIn: $isLoggedIn) {
        id
        opening {
          id
          postedOn
          description
          urlToShorten
          duration {
            label
          }
          budget {
            amount
            currencyCode
          }
          extendedBudgetInfo {
            hourlyBudgetMin
            hourlyBudgetMax
            amount
            currencyCode
          }
          info {
            title
            type
            contractorTier
          }
          clientActivity {
            totalApplicants
            totalInterviews
            hireRate
          }
        }
        buyer {
          numReviews
          rating
          totalSpent
          totalHires
          stats {
            score
          }
          location {
            country
          }
        }
      }
    }
    """

# Visitor job search GraphQL query
VISITOR_JOB_SEARCH_QUERY = '''query VisitorJobSearch($requestVariables: VisitorJobSearchV1Request!) {
    search {
        universalSearchNuxt {
            visitorJobSearchV1(request: $requestVariables) {
                paging {
                    total
                    offset
                    count
                }
                facets {
                    jobType {
                        key
                        value
                    }
                    workload {
                        key
                        value
                    }
                    clientHires {
                        key
                        value
                    }
                    durationV3 {
                        key
                        value
                    }
                    amount {
                        key
                        value
                    }
                    contractorTier {
                        key
                        value
                    }
                    contractToHire {
                        key
                        value
                    }
                }
                results {
                    id
                    title
                    description
                    relevanceEncoded
                    ontologySkills {
                        uid
                        parentSkillUid
                        prefLabel
                        prettyName: prefLabel
                        freeText
                        highlighted
                    }
                    jobTile {
                        job {
                            id
                            ciphertext: cipherText
                            jobType
                            weeklyRetainerBudget
                            hourlyBudgetMax
                            hourlyBudgetMin
                            hourlyEngagementType
                            contractorTier
                            sourcingTimestamp
                            createTime
                            publishTime
                            hourlyEngagementDuration {
                                rid
                                label
                                weeks
                                mtime
                                ctime
                            }
                            fixedPriceAmount {
                                isoCurrencyCode
                                amount
                            }
                            fixedPriceEngagementDuration {
                                id
                                rid
                                label
                                weeks
                                ctime
                                mtime
                            }
                        }
                    }
                }
            }
        }
    }
}'''

# Minimal visitor job search GraphQL query
MINIMAL_VISITOR_JOB_SEARCH_QUERY = '''query VisitorJobSearch($requestVariables: VisitorJobSearchV1Request!) {
    search {
        universalSearchNuxt {
            visitorJobSearchV1(request: $requestVariables) {
                paging {
                    total
                    offset
                    count
                }
                results {
                    id
                    title
                    description
                    jobTile {
                        job {
                            id
                            ciphertext: cipherText
                            jobType
                            createTime
                            publishTime
                            fixedPriceAmount {
                                amount
                            }
                            hourlyBudgetMin
                            hourlyBudgetMax
                        }
                    }
                }
            }
        }
    }
}'''
