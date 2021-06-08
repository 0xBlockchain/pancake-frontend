import BigNumber from 'bignumber.js'
import { DEFAULT_GAS_LIMIT, DEFAULT_TOKEN_DECIMAL } from 'config'
import { ethers } from 'ethers'
import { Pair, TokenAmount, Token } from '@pancakeswap/sdk'
import { getBep20Contract, getLpContract, getMasterchefContract, getSouschefV2Contract } from 'utils/contractHelpers'
import farms from 'config/constants/farms'
import { getAddress, getCakeAddress } from 'utils/addressHelpers'
import tokens from 'config/constants/tokens'
import pools from 'config/constants/pools'
import { getWeb3WithArchivedNodeProvider } from './web3'
import { getBalanceAmount } from './formatBalance'
import { BIG_TEN, BIG_ZERO } from './bigNumber'

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

const chainId = parseInt(process.env.REACT_APP_CHAIN_ID, 10)
const cakeBnbPid = 251
const cakeBnbFarm = farms.find((farm) => farm.pid === cakeBnbPid)

const CAKE_TOKEN = new Token(chainId, getCakeAddress(), 18)
const WBNB_TOKEN = new Token(chainId, tokens.wbnb.address[chainId], 18)
const CAKE_BNB_TOKEN = new Token(chainId, getAddress(cakeBnbFarm.lpAddresses), 18)

/**
 * Returns the total CAKE staked in the CAKE-BNB LP
 */
export const getUserStakeInCakeBnbLp = async (account: string, block?: number) => {
  try {
    const archivedWeb3 = getWeb3WithArchivedNodeProvider()
    const masterContract = getMasterchefContract(archivedWeb3)
    const cakeBnbContract = getLpContract(getAddress(cakeBnbFarm.lpAddresses), archivedWeb3)
    const totalSupplyLP = await cakeBnbContract.methods.totalSupply().call(undefined, block)
    const reservesLP = await cakeBnbContract.methods.getReserves().call(undefined, block)
    const cakeBnbBalance = await masterContract.methods.userInfo(cakeBnbPid, account).call(undefined, block)

    const pair: Pair = new Pair(
      new TokenAmount(CAKE_TOKEN, reservesLP._reserve0.toString()),
      new TokenAmount(WBNB_TOKEN, reservesLP._reserve1.toString()),
    )
    const cakeLPBalance = pair.getLiquidityValue(
      pair.token0,
      new TokenAmount(CAKE_BNB_TOKEN, totalSupplyLP.toString()),
      new TokenAmount(CAKE_BNB_TOKEN, cakeBnbBalance.amount.toString()),
      false,
    )

    return new BigNumber(cakeLPBalance.toSignificant(18))
  } catch (error) {
    console.error(`CAKE-BNB LP error: ${error}`)
    return BIG_ZERO
  }
}

/**
 * Gets the cake staked in the main pool
 */
export const getUserStakeInCakePool = async (account: string, block?: number) => {
  try {
    const archivedWeb3 = getWeb3WithArchivedNodeProvider()
    const masterContract = getMasterchefContract(archivedWeb3)
    const response = await masterContract.methods.userInfo(0, account).call(undefined, block)

    return getBalanceAmount(new BigNumber(response.amount))
  } catch (error) {
    console.error('Error getting stake in CAKE pool', error)
    return BIG_ZERO
  }
}

const getUserStakeInPool = async (sousId: number, account: string, block?: number) => {
  try {
    const archivedWeb3 = getWeb3WithArchivedNodeProvider()
    const sousChefV2Contract = getSouschefV2Contract(sousId, archivedWeb3)
    const [currentBlock, startBlockResponse, endBlockResponse] = await Promise.all([
      archivedWeb3.eth.getBlockNumber(),
      sousChefV2Contract.methods.startBlock().call(),
      sousChefV2Contract.methods.bonusEndBlock().call(),
    ])
    const blockNumber = block || currentBlock
    const startBlock = new BigNumber(startBlockResponse)
    const endBlock = new BigNumber(endBlockResponse)

    // Bail out if pool was not active during the supplied block
    if (startBlock.gt(blockNumber) || endBlock.lt(blockNumber)) {
      return BIG_ZERO
    }

    const userInfo = await sousChefV2Contract.methods.userInfo(account).call(undefined, blockNumber)
    return new BigNumber(userInfo.amount)
  } catch (error) {
    return BIG_ZERO
  }
}

/**
 * Returns total staked value of active pools
 */
export const getUserStakeInPools = async (account: string, block?: number) => {
  try {
    const eligiblePools = pools
      .filter((pool) => pool.sousId !== 0)
      .filter((pool) => pool.isFinished === false || pool.isFinished === undefined)
    const balances = await Promise.all(eligiblePools.map(({ sousId }) => getUserStakeInPool(sousId, account, block)))

    return getBalanceAmount(
      balances.reduce((accum, balance) => {
        return accum.plus(balance)
      }, new BigNumber(0)),
    )
  } catch (error) {
    console.error('Error fetching staked values:', error)
    return BIG_ZERO
  }
}

/**
 * One-time check of wallet's cake balance
 */
export const getCakeBalance = async (account: string, block?: number) => {
  try {
    const archivedWeb3 = getWeb3WithArchivedNodeProvider()
    const bep20Contract = getBep20Contract(getCakeAddress(), archivedWeb3)
    const cakeBalance = await bep20Contract.methods.balanceOf(account).call(undefined, block)
    return getBalanceAmount(new BigNumber(cakeBalance))
  } catch (error) {
    console.error('Error fetching cake balance:', error)
    return BIG_ZERO
  }
}
