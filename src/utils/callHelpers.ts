import BigNumber from 'bignumber.js'
import { DEFAULT_GAS_LIMIT, DEFAULT_TOKEN_DECIMAL } from 'config'
import { ethers } from 'ethers'
import { getAddress } from 'utils/addressHelpers'
import pools from 'config/constants/pools'
import sousChefABI from 'config/abi/sousChef.json'
import { getWeb3WithArchivedNodeProvider } from './web3'
import { BIG_TEN, BIG_ZERO } from './bigNumber'
import { multicallv2, MultiCallV2Result } from './multicall'

export const approve = async (lpContract, masterChefContract, account) => {
  return lpContract.methods
    .approve(masterChefContract.options.address, ethers.constants.MaxUint256)
    .send({ from: account })
}

export const stake = async (masterChefContract, pid, amount, account) => {
  if (pid === 0) {
    return masterChefContract.methods
      .enterStaking(new BigNumber(amount).times(DEFAULT_TOKEN_DECIMAL).toString())
      .send({ from: account, gas: DEFAULT_GAS_LIMIT })
      .on('transactionHash', (tx) => {
        return tx.transactionHash
      })
  }

  return masterChefContract.methods
    .deposit(pid, new BigNumber(amount).times(DEFAULT_TOKEN_DECIMAL).toString())
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const sousStake = async (sousChefContract, amount, decimals = 18, account) => {
  return sousChefContract.methods
    .deposit(new BigNumber(amount).times(BIG_TEN.pow(decimals)).toString())
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const sousStakeBnb = async (sousChefContract, amount, account) => {
  return sousChefContract.methods
    .deposit()
    .send({
      from: account,
      gas: DEFAULT_GAS_LIMIT,
      value: new BigNumber(amount).times(DEFAULT_TOKEN_DECIMAL).toString(),
    })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const unstake = async (masterChefContract, pid, amount, account) => {
  if (pid === 0) {
    return masterChefContract.methods
      .leaveStaking(new BigNumber(amount).times(DEFAULT_TOKEN_DECIMAL).toString())
      .send({ from: account, gas: DEFAULT_GAS_LIMIT })
      .on('transactionHash', (tx) => {
        return tx.transactionHash
      })
  }

  return masterChefContract.methods
    .withdraw(pid, new BigNumber(amount).times(DEFAULT_TOKEN_DECIMAL).toString())
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const sousUnstake = async (sousChefContract, amount, decimals, account) => {
  return sousChefContract.methods
    .withdraw(new BigNumber(amount).times(BIG_TEN.pow(decimals)).toString())
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const sousEmergencyUnstake = async (sousChefContract, account) => {
  return sousChefContract.methods
    .emergencyWithdraw()
    .send({ from: account })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const harvest = async (masterChefContract, pid, account) => {
  if (pid === 0) {
    return masterChefContract.methods
      .leaveStaking('0')
      .send({ from: account, gas: DEFAULT_GAS_LIMIT })
      .on('transactionHash', (tx) => {
        return tx.transactionHash
      })
  }

  return masterChefContract.methods
    .deposit(pid, '0')
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const soushHarvest = async (sousChefContract, account) => {
  return sousChefContract.methods
    .deposit('0')
    .send({ from: account, gas: DEFAULT_GAS_LIMIT })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const soushHarvestBnb = async (sousChefContract, account) => {
  return sousChefContract.methods
    .deposit()
    .send({ from: account, gas: DEFAULT_GAS_LIMIT, value: BIG_ZERO })
    .on('transactionHash', (tx) => {
      return tx.transactionHash
    })
}

export const getActivePools = async (block?: number) => {
  const archivedWeb3 = getWeb3WithArchivedNodeProvider()
  const eligiblePools = pools
    .filter((pool) => pool.sousId !== 0)
    .filter((pool) => pool.isFinished === false || pool.isFinished === undefined)
  const blockNumber = block || (await archivedWeb3.eth.getBlockNumber())
  const multiCallOptions = {
    web3: archivedWeb3,
    requireSuccess: false,
    blockNumber,
  }

  const startBlocks = (await multicallv2(
    sousChefABI,
    eligiblePools.map(({ contractAddress }) => {
      return {
        address: getAddress(contractAddress),
        name: 'startBlock',
      }
    }),
    multiCallOptions,
  )) as MultiCallV2Result<BigNumber>[]
  const endBlocks = (await multicallv2(
    sousChefABI,
    eligiblePools.map(({ contractAddress }) => {
      return {
        address: getAddress(contractAddress),
        name: 'bonusEndBlock',
      }
    }),
    multiCallOptions,
  )) as MultiCallV2Result<BigNumber>[]

  return eligiblePools.reduce((accum, pool, index) => {
    const { data: startBlockData } = startBlocks[index]
    const { data: endBlockData } = endBlocks[index]
    const startBlock = new BigNumber(startBlockData[0]._hex)
    const endBlock = new BigNumber(endBlockData[0]._hex)

    if (startBlock.gt(blockNumber) || endBlock.lt(blockNumber)) {
      return accum
    }

    return [...accum, pool]
  }, [])
}
